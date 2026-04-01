import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { calculateTargetDeadline, getPriorityFromDueByType, isTaskOverdue } from '../utils/dateUtils';

// Helper to calculate stats from tasks array
export const calculateStats = (tasks) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return {
        p1: tasks.filter(t => t.priority && t.priority.includes('P1') && t.status !== 'Done' && t.status !== 'Deleted' && !t.is_archived).length,
        p2: tasks.filter(t => t.priority && t.priority.includes('P2') && t.status !== 'Done' && t.status !== 'Deleted' && !t.is_archived).length,
        p3: tasks.filter(t => t.priority && t.priority.includes('P3') && t.status !== 'Done' && t.status !== 'Deleted' && !t.is_archived).length,
        backburner: tasks.filter(t => t.priority === 'Backburner' && t.status !== 'Done' && t.status !== 'Deleted' && !t.is_archived).length,
        completed: tasks.filter(t => {
            if (t.status !== 'Done') return false;
            const compDate = t.deletion_date || t.submitted_on || t.created_at || t.date;
            return new Date(compDate) >= sevenDaysAgo;
        }).length,
        // UPDATED: Only P1 tasks can be overdue
        overdue: tasks.filter(t => t.status !== 'Done' && t.status !== 'Deleted' && !t.is_archived && t.priority && t.priority.includes('P1') && isTaskOverdue(t.target_deadline)).length
    };
};

export function useTasks() {
    const [tasks, setTasks] = useState([]);
    const [teamMembers, setTeamMembers] = useState([]);
    const [categories, setCategories] = useState([]);
    const [profiles, setProfiles] = useState([]); // Store actual user profiles
    const [rewards, setRewards] = useState([]); // Reward definitions from admin
    const [userSettings, setUserSettings] = useState({ dnd_mobile_enabled: true, dnd_desktop_enabled: false }); // User preferences
    const [companyName, setCompanyName] = useState('TEAM ROOXTER'); // Global App Setting
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            // NEW: Added profiles to the initial fetch to get real Auth UUIDs
            const [tasksResult, teamsResult, categoriesResult, profilesResult, rewardsResult, settingsResult, appSettingsResult] = await Promise.all([
                supabase.from('tasks').select('*').order('id', { ascending: false }),
                supabase.from('team_members').select('*').order('name', { ascending: true }),
                supabase.from('categories').select('*').order('name', { ascending: true }),
                supabase.from('profiles').select('id, email, role, first_name, last_name, title, theme, name'),
                supabase.from('rewards').select('*').order('slot', { ascending: true }),
                supabase.from('user_settings').select('dnd_mobile_enabled, dnd_desktop_enabled').limit(1),
                supabase.from('app_settings').select('*')
            ]);

            if (tasksResult.error) throw tasksResult.error;
            if (teamsResult.error) throw teamsResult.error;
            if (categoriesResult.error) throw categoriesResult.error;
            if (profilesResult.error) throw profilesResult.error;
            // Rewards table may not exist yet, so don't throw
            if (rewardsResult.error) console.warn('Rewards fetch error (run the SQL migration):', rewardsResult.error);
            // Settings table might not exist yet or have no row for current user
            if (settingsResult.error) console.warn('Settings fetch error (run the SQL migration):', settingsResult.error);

            setTasks(tasksResult.data || []);
            setTeamMembers(teamsResult.data || []);
            setCategories(categoriesResult.data || []);
            setProfiles(profilesResult.data || []);
            
            if (appSettingsResult && !appSettingsResult.error && appSettingsResult.data) {
                const cnRow = appSettingsResult.data.find(r => r.setting_key === 'company_name');
                if (cnRow?.setting_value) {
                    setCompanyName(cnRow.setting_value);
                }
            }
            
            if (settingsResult.data && settingsResult.data.length > 0) {
                setUserSettings(settingsResult.data[0]);
            } else {
                setUserSettings({ dnd_mobile_enabled: true, dnd_desktop_enabled: false }); // default
            }
            
            // Map rewards to 10 slots (fill missing slots with defaults)
            const fetchedRewards = rewardsResult.data || [];
            const rewardSlots = Array.from({ length: 10 }, (_, i) => {
                const existing = fetchedRewards.find(r => r.slot === i + 1);
                return existing || { slot: i + 1, title: '', requirement: '', reward: '' };
            });
            setRewards(rewardSlots);

            // 30-Day Trash Cleanup Logic
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const tasksToDelete = (tasksResult.data || []).filter(t =>
                t.status === 'Deleted' &&
                t.deletion_date &&
                new Date(t.deletion_date) < thirtyDaysAgo
            ).map(t => t.id);

            if (tasksToDelete.length > 0) {
                await supabase.from('tasks').delete().in('id', tasksToDelete);
            }

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    // --- AUTO PRIORITY ESCALATION ENGINE ---
    // Scans active tasks and promotes them to tighter deadlines as their 
    // absolute end-date approaches. Runs on fetch and 60s intervals.
    const escalatePriorities = async (taskList) => {
        const now = new Date().getTime();
        const ONE_DAY = 24 * 60 * 60 * 1000;
        
        const tasksToP1Today = [];
        const tasksToP2ThreeDays = [];
        const tasksToP2ThisWeek = [];

        for (const t of taskList) {
            // Only escalate active tasks that have an explicit deadline
            if (t.status === 'Done' || t.status === 'Deleted' || t.is_archived) continue;
            if (!t.target_deadline) continue;
            
            // Backburners are explicitly frozen and NEVER auto-escalate
            if (t.due_by_type === 'Backburner' || t.priority === 'Backburner') continue;

            const timeRemaining = new Date(t.target_deadline).getTime() - now;

            // 1. Escalate to P1 (Today) - ≤ 1 day remaining
            // Automatically promote everything missing this deadline
            if (timeRemaining <= ONE_DAY) {
                if (t.priority !== 'P1 (Critical)' || t.due_by_type !== 'Today') {
                    tasksToP1Today.push(t.id);
                }
            } 
            // 2. Escalate to P2 (3 days) - > 1 day AND ≤ 3 days
            else if (timeRemaining <= 3 * ONE_DAY) {
                // Only escalate upwards (From "This Month" or "This Week")
                if (t.due_by_type === 'This Month' || t.due_by_type === 'This Week') {
                    tasksToP2ThreeDays.push(t.id);
                }
            }
            // 3. Escalate to P2 (This Week) - > 3 days AND ≤ 7 days
            else if (timeRemaining <= 7 * ONE_DAY) {
                // Only escalate upwards (From "This Month")
                if (t.due_by_type === 'This Month') {
                    tasksToP2ThisWeek.push(t.id);
                }
            }
        }

        const runTierUpdate = async (ids, payload) => {
            if (ids.length === 0) return;
            // Optimistic local update
            setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, ...payload } : t));
            
            // Batch update to database
            const { error } = await supabase.from('tasks').update(payload).in('id', ids);
            if (error) console.error('Error escalating priorities:', error);
        };

        await runTierUpdate(tasksToP1Today, { priority: 'P1 (Critical)', due_by_type: 'Today' });
        await runTierUpdate(tasksToP2ThreeDays, { priority: 'P2', due_by_type: '3 days' });
        await runTierUpdate(tasksToP2ThisWeek, { priority: 'P2', due_by_type: 'This Week' });
    };

    // Run escalation after initial fetch completes and on an interval
    useEffect(() => {
        if (!loading && tasks.length > 0) {
            escalatePriorities(tasks);
        }
    }, [loading]);

    // Periodic check every 60 seconds to catch tasks crossing the threshold
    useEffect(() => {
        const interval = setInterval(() => {
            if (tasks.length > 0) {
                escalatePriorities(tasks);
            }
        }, 60000);
        return () => clearInterval(interval);
    }, [tasks]);

    // NEW: Safe helper to get the TRUE assignee data without crashing
    const getAssigneeData = (assigneeName) => {
        if (!assigneeName) return { assignee_id: null, assignee_email: null };
        
        const member = teamMembers.find(m => m.name === assigneeName);
        if (!member || !member.email) return { assignee_id: null, assignee_email: null };

        // Cross-reference the email with the profiles table to get the REAL Auth UUID
        const profile = profiles.find(p => p.email?.toLowerCase().trim() === member.email?.toLowerCase().trim());
        
        return {
            assignee_email: member.email,
            assignee_id: profile ? profile.id : null
        };
    };

    const addTeamMember = async (name, email = '') => {
        const id = crypto.randomUUID();
        const newMember = { id, name, email };
        setTeamMembers(prev => [...prev, newMember]);

        const { data, error } = await supabase
            .from('team_members')
            .insert([newMember])
            .select();

        if (error) {
            console.error('Error adding team member:', error);
        } else if (data) {
            setTeamMembers(prev => prev.map(m => m.id === id ? data[0] : m));
            fetchData(); // Refresh to catch new profile links
        }
        return data;
    };

    const deleteTeamMember = async (member) => {
        setTeamMembers(prev => prev.filter(m => m.id !== member.id));
        setTasks(prev => prev.map(t => t.assignee === member.name ? { ...t, is_archived: true } : t));

        const { error: tasksError } = await supabase.from('tasks').update({ is_archived: true }).eq('assignee', member.name);
        const { error: memError } = await supabase.from('team_members').delete().eq('id', member.id);

        if (tasksError || memError) fetchData();
    };

    const updateTeamMember = async (id, newName) => {
        const member = teamMembers.find(m => m.id === id);
        if (!member) return;
        const oldName = member.name;

        setTeamMembers(prev => prev.map(m => m.id === id ? { ...m, name: newName } : m));
        setTasks(prev => prev.map(t => t.assignee === oldName ? { ...t, assignee: newName } : t));

        const { error: mErr } = await supabase.from('team_members').update({ name: newName }).eq('id', id);
        const { error: tErr } = await supabase.from('tasks').update({ assignee: newName }).eq('assignee', oldName);

        if (mErr || tErr) fetchData();
    };

    const addCategory = async (name, createdBy = null, isPrivateOverride = false) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        
        // Auto-assign createdBy if worker and no override provided
        let assignCreator = createdBy;
        if (assignCreator === null) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const myProfile = profiles.find(p => p.id === session.user.id);
                if (myProfile?.role === 'worker' || isPrivateOverride) {
                    assignCreator = session.user.id;
                }
            }
        }

        const id = crypto.randomUUID();
        const newCategory = { id, name: trimmed, created_by: assignCreator };
        setCategories(prev => [...prev, newCategory]);

        const { data, error } = await supabase.from('categories').insert([newCategory]).select();

        if (error) {
            console.error('Error adding category:', error);
        } else if (data) {
            setCategories(prev => prev.map(c => c.id === id ? data[0] : c));
        }
        return data;
    };

    const updateCategory = async (id, newName) => {
        const trimmed = newName.trim();
        if (!trimmed) return;
        
        setCategories(prev => prev.map(c => c.id === id ? { ...c, name: trimmed } : c));
        
        const { error } = await supabase.from('categories').update({ name: trimmed }).eq('id', id);
        if (error) fetchData();
    };

    const deleteCategory = async (id) => {
        setCategories(prev => prev.filter(c => c.id !== id));
        const { error } = await supabase.from('categories').delete().eq('id', id);
        if (error) fetchData();
    };

    const addTask = async (assignee, creatorRole) => {
        const dueByType = 'This Week'; 
        const defaultCategory = categories.length > 0 ? categories[0].name : '';
        const id = crypto.randomUUID();

        // Safely pull the ID and Email
        const { assignee_id, assignee_email } = getAssigneeData(assignee);

        // Determine assignee's role from profiles (for DB tracking)
        const assigneeProfile = assignee_id ? profiles.find(p => p.id === assignee_id) : null;
        const assigneeRole = assigneeProfile?.role || 'worker';

        const newTask = {
            id,
            status: 'To Do',
            action: '',
            category: defaultCategory,
            due_by_type: dueByType,
            priority: getPriorityFromDueByType(dueByType),
            target_deadline: calculateTargetDeadline(dueByType),
            submitted_on: new Date().toISOString(),
            assignee: assignee || '',
            assignee_id,
            assignee_email,
            is_archived: false,
            assigned_by_role: creatorRole || 'admin',
            assignee_role: assigneeRole,
        };

        setTasks(prev => [newTask, ...prev]);

        const { error } = await supabase.from('tasks').insert([newTask]);

        if (error) {
            console.error('Error adding task:', error);
            alert(`DB INSERT ERROR: ${error.message || JSON.stringify(error)}`);
        }

        return newTask;
    };


    const updateTask = async (id, fieldOrObject, value) => {
        let updates = {};

        if (typeof fieldOrObject === 'object' && fieldOrObject !== null) {
            updates = { ...fieldOrObject };
        } else {
            updates = { [fieldOrObject]: value };
        }

        if (updates.due_by_type) {
            updates.priority = getPriorityFromDueByType(updates.due_by_type);
            updates.target_deadline = calculateTargetDeadline(updates.due_by_type);
        }

        // NEW: Intercept assignee changes to dynamically append email and UUID
        if (updates.assignee !== undefined) {
            const { assignee_id, assignee_email } = getAssigneeData(updates.assignee);
            updates.assignee_id = assignee_id;
            updates.assignee_email = assignee_email;
        }

        // FIXED: Explicitly added the new columns to the whitelist
        const validSchemaKeys = [
            'action', 'assignee', 'category', 'due_by_type', 'priority',
            'status', 'is_archived', 'target_deadline', 'submitted_on', 'deletion_date',
            'assignee_id', 'assignee_email', 'is_notified', 'notes'
        ];
        
        const dbUpdates = {};
        for (const [key, val] of Object.entries(updates)) {
            if (validSchemaKeys.includes(key)) {
                dbUpdates[key] = val;
            }
        }

        setTasks(prevTasks => prevTasks.map(t => t.id === id ? { ...t, ...updates } : t));

        if (Object.keys(dbUpdates).length > 0) {
            const { error } = await supabase
                .from('tasks')
                .update(dbUpdates)
                .eq('id', id);

            if (error) {
                console.error('Error updating task:', error);
                alert(`DB UPDATE ERROR: ${error.message || JSON.stringify(error)}`);
            }
        }
    };

    const deleteTask = async (id) => {
        setTasks(tasks.filter(t => t.id !== id));
        const { error } = await supabase.from('tasks').delete().eq('id', id);
        if (error) fetchData();
    };

    const permanentlyDeleteTask = async (id) => {
        return deleteTask(id);
    };

    const resetData = async () => {
        if (confirm('Reload data from server?')) {
            fetchData();
        }
    };

    const updateProfileRole = async (profileId, newRole) => {
        setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, role: newRole } : p));
        const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', profileId);
        if (error) fetchData();
    };

    const terminateProfile = async (profileId, email) => {
        if (!confirm(`Are you sure you want to completely terminate the access for ${email}? This action cannot be undone.`)) return;
        
        // Optimistically remove from UI
        setProfiles(prev => prev.filter(p => p.id !== profileId));
        setTeamMembers(prev => prev.filter(m => m.user_id !== profileId && m.email !== email));
        
        // Drop the profile
        const { error: pErr } = await supabase.from('profiles').delete().eq('id', profileId);
        // Drop them from team members just in case
        const { error: mErr } = await supabase.from('team_members').delete().eq('email', email);
        
        if (pErr || mErr) fetchData();
    };

    const stats = useMemo(() => calculateStats(tasks), [tasks]);

    // --- NEW: Update User Profile Metadata ---
    const updateProfileDetails = async (id, { first_name, last_name, title }) => {
        const payload = { first_name, last_name, title };
        
        // Optimistic UI Update
        setProfiles(prev => prev.map(p => p.id === id ? { ...p, ...payload } : p));

        const { error } = await supabase
            .from('profiles')
            .update(payload)
            .eq('id', id);

        if (error) {
            console.error('Error updating profile metadata:', error);
            fetchData(); // rollback
        }
    };

    // --- NEW: Update User Theme Preference ---
    const updateProfileTheme = async (id, newTheme) => {
        // Optimistic UI Update
        setProfiles(prev => prev.map(p => p.id === id ? { ...p, theme: newTheme } : p));

        const { error } = await supabase
            .from('profiles')
            .update({ theme: newTheme })
            .eq('id', id);

        if (error) {
            console.error('Error updating profile theme:', error);
            fetchData(); // rollback
        }
    };

    // --- Update Reward Slot ---
    const updateReward = async (slot, field, value, userEmail, userRole) => {
        // Optimistic update
        setRewards(prev => prev.map(r => r.slot === slot ? { ...r, [field]: value } : r));

        const { error } = await supabase
            .from('rewards')
            .upsert({
                slot,
                [field]: value,
                created_by_email: userEmail,
                created_by_role: userRole,
                updated_at: new Date().toISOString()
            }, { onConflict: 'slot' });

        if (error) {
            console.error('Error updating reward:', error);
            fetchData();
        }
    };

    // --- Update User Settings ---
    const updateUserSetting = async (userId, key, value) => {
        // Optimistic UI Update
        setUserSettings(prev => ({ ...prev, [key]: value }));

        const { error } = await supabase
            .from('user_settings')
            .upsert({ user_id: userId, [key]: value, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

        if (error) {
            console.error('Error updating user setting:', error);
            fetchData(); // rollback
        }
    };

    // --- Update Global Company Name ---
    const updateCompanyName = async (newName, userId) => {
        setCompanyName(newName);
        const { error } = await supabase
            .from('app_settings')
            .upsert({ 
                setting_key: 'company_name', 
                setting_value: newName, 
                updated_by: userId, 
                updated_at: new Date().toISOString() 
            }, { onConflict: 'setting_key' });
        
        if (error) {
            console.error("Error saving company name:", error);
            fetchData();
        }
    };

    return {
        tasks,
        teamMembers,
        categories,
        profiles,
        rewards,
        userSettings,
        companyName,
        stats,
        addTask,
        addTeamMember,
        deleteTeamMember,
        updateTeamMember,
        addCategory,
        updateCategory,
        deleteCategory,
        updateTask,
        deleteTask,
        permanentlyDeleteTask,
        updateProfileRole,
        terminateProfile,
        updateProfileDetails,
        updateProfileTheme,
        updateReward,
        updateUserSetting,
        updateCompanyName,
        resetData,
        loading
    };
}
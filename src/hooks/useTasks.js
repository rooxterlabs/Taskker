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
        overdue: tasks.filter(t => t.status !== 'Done' && t.status !== 'Deleted' && !t.is_archived && isTaskOverdue(t.target_deadline)).length
    };
};

export function useTasks() {
    const [tasks, setTasks] = useState([]);
    const [teamMembers, setTeamMembers] = useState([]);
    const [categories, setCategories] = useState([]);
    const [profiles, setProfiles] = useState([]); // NEW: Store actual user profiles
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            // NEW: Added profiles to the initial fetch to get real Auth UUIDs
            const [tasksResult, teamsResult, categoriesResult, profilesResult] = await Promise.all([
                supabase.from('tasks').select('*').order('id', { ascending: false }),
                supabase.from('team_members').select('*').order('name', { ascending: true }),
                supabase.from('categories').select('*').order('name', { ascending: true }),
                supabase.from('profiles').select('id, email, role, first_name, last_name, title') 
            ]);

            if (tasksResult.error) throw tasksResult.error;
            if (teamsResult.error) throw teamsResult.error;
            if (categoriesResult.error) throw categoriesResult.error;

            setTasks(tasksResult.data || []);
            setTeamMembers(teamsResult.data || []);
            setCategories(categoriesResult.data || []);
            setProfiles(profilesResult.data || []);

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

    const addCategory = async (name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const id = crypto.randomUUID();
        const newCategory = { id, name: trimmed };
        setCategories(prev => [...prev, newCategory]);

        const { data, error } = await supabase.from('categories').insert([newCategory]).select();

        if (error) {
            console.error('Error adding category:', error);
        } else if (data) {
            setCategories(prev => prev.map(c => c.id === id ? data[0] : c));
        }
        return data;
    };

    const deleteCategory = async (id) => {
        setCategories(prev => prev.filter(c => c.id !== id));
        const { error } = await supabase.from('categories').delete().eq('id', id);
        if (error) fetchData();
    };

    const addTask = async (assignee) => {
        const dueByType = 'This Week'; 
        const defaultCategory = categories.length > 0 ? categories[0].name : '';
        const id = crypto.randomUUID();

        // Safely pull the ID and Email
        const { assignee_id, assignee_email } = getAssigneeData(assignee);

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
            is_archived: false
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
            'assignee_id', 'assignee_email'
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

    return {
        tasks,
        teamMembers,
        categories,
        profiles,
        stats,
        addTask,
        addTeamMember,
        deleteTeamMember,
        updateTeamMember,
        addCategory,
        deleteCategory,
        updateTask,
        deleteTask,
        permanentlyDeleteTask,
        updateProfileRole,
        terminateProfile,
        updateProfileDetails,
        resetData,
        loading
    };
}
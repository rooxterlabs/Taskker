import React, { useState, useEffect } from 'react';
import {
    Plus,
    Award,
    Circle,
    RotateCcw,
    LayoutDashboard,
    Users,
    Archive,
    Trash2,
    Zap,
    Calendar,
    OctagonAlert,
    CheckCircle2,
    Activity,
    BarChart3,
    CheckSquare,
    Square,
    ChevronDown,
    UserPlus,
    Pencil,
    X,
    Coffee,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Globe,
    List,
    User,
    Settings,
    Minus,
    MoreHorizontal,
    FileText,
    AlertTriangle,
    Bell,
    Palette,
    Shield,
    LogOut,
    Search,
    Flame,
    ThumbsUp,
    PartyPopper,
    FolderKanban
} from 'lucide-react';
import { useTasks, calculateStats } from './hooks/useTasks';
import { STATUS_OPTIONS, DUE_BY_OPTIONS } from './constants';
import { formatDate, isTaskOverdue } from './utils/dateUtils';
import {
    DndContext,
    pointerWithin,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
    useDroppable,
    useDraggable
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { snapCenterToCursor } from '@dnd-kit/modifiers';

import confetti from 'canvas-confetti';
import doneSoundUrl from './assets/sounds/taskker_done_v01.wav';
import Login from './components/Login';
import InviteMemberForm from './components/InviteMemberForm';
import OnboardingGate from './components/OnboardingGate';
import RoleGate from './components/RoleGate';
import PatchNotesModal from './components/PatchNotesModal';
import { supabase } from './lib/supabase';

// --- Reusable Micro-interaction Components ---
function DoneCheckbox({ task, updateTask, className }) {
    const [isCompleting, setIsCompleting] = React.useState(false);

    const handleDoneClick = (e) => {
        e.stopPropagation();
        if (task.status === 'Done') {
            updateTask(task.id, 'status', 'In Progress');
        } else {
            setIsCompleting(true);

            // Trigger Sound
            try {
                const audio = new Audio(doneSoundUrl);
                audio.play().catch(err => console.log('Audio error:', err));
            } catch (err) { }

            // Trigger Confetti explosion from button origin
            const rect = e.currentTarget.getBoundingClientRect();
            const x = (rect.left + rect.width / 2) / window.innerWidth;
            const y = (rect.top + rect.height / 2) / window.innerHeight;

            confetti({
                particleCount: 15,
                spread: 60,
                startVelocity: 15,
                colors: ['#10b981', '#34d399', '#059669', '#a7f3d0'],
                origin: { x, y },
                zIndex: 9999,
                disableForReducedMotion: true,
                ticks: 100,
                gravity: 0.8,
                scalar: 0.8
            });

            // Grace period before actual state removal
            setTimeout(() => {
                updateTask(task.id, 'status', 'Done');
                // Note: component usually unmounts here as it's removed from view
            }, 700);
        }
    };

    const isDone = task.status === 'Done' || isCompleting;

    return (
        <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleDoneClick}
            className={`rounded-full border-2 flex items-center justify-center transition-colors ${className || 'w-5 h-5 mx-auto'} ${isDone ? 'bg-emerald-500 border-emerald-500' : 'border-slate-500 hover:border-blue-400'}`}
        >
            {isDone && <CheckCircle2 className="w-3 h-3 text-slate-900" />}
        </button>
    );
}

export default function App() {
    const {
        tasks,
        teamMembers,
        categories,
        profiles,
        rewards,
        userSettings,
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
        companyName,
        updateCompanyName,
        resetData,
        loading
    } = useTasks();

    const [activeTab, setActiveTab] = useState('dashboard');
    const [selectedMember, setSelectedMember] = useState(null);
    const [rosterSearchQuery, setRosterSearchQuery] = useState('');
    const [isRosterSearchOpen, setIsRosterSearchOpen] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [modalFilter, setModalFilter] = useState(null); // 'P1', 'P2', 'P3', 'Completed', 'Overdue', 'Backburner'
    const [currentMonthDate, setCurrentMonthDate] = useState(new Date());

    const [showAllTasksBoard, setShowAllTasksBoard] = useState(false);
    const [showMyTasksBoard, setShowMyTasksBoard] = useState(false);
    const [allTasksCategoryFilter, setAllTasksCategoryFilter] = useState('All');
    const [selectedDateTasks, setSelectedDateTasks] = useState(null);
    const [dayModeDateStr, setDayModeDateStr] = useState(null);
    const [calendarMode, setCalendarMode] = useState('week'); // 'day', 'month' or 'week'
    const [isBottomBarOpen, setIsBottomBarOpen] = useState(false);
    const [isGlobalAddTaskOpen, setIsGlobalAddTaskOpen] = useState(false);
    const [isPersonalTaskMode, setIsPersonalTaskMode] = useState(false);
    const [isPatchNotesOpen, setIsPatchNotesOpen] = useState(false);
    const [isFunModalOpen, setIsFunModalOpen] = useState(false);
    
    // Profile & Settings State
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [settingsModalTab, setSettingsModalTab] = useState('profile');

    // Admin Settings State
    const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
    const [adminModalTab, setAdminModalTab] = useState('Invite Team');


    const handleSignOut = async () => {
        setIsProfileMenuOpen(false);
        const { error } = await supabase.auth.signOut();
        if (error) console.error("Error signing out:", error);
    };

    const openSettings = (tab) => {
        setSettingsModalTab(tab);
        setIsSettingsModalOpen(true);
        setIsProfileMenuOpen(false);
        setIsBottomBarOpen(false);
    };

    const openAdminSettings = (tab) => {
        setAdminModalTab(tab);
        setIsAdminModalOpen(true);
        setIsBottomBarOpen(false);
    };

    // Auth State
    const [session, setSession] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [isOnboarding, setIsOnboarding] = useState(
        window.location.hash.includes('type=invite') || window.location.hash.includes('type=recovery')
    );

    const currentUserProfile = profiles.find(p => p.id === session?.user?.id) || {};

    const teamDropdownRef = React.useRef(null);
    const profileDropdownRef = React.useRef(null);

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
                setIsProfileMenuOpen(false);
            }
            if (teamDropdownRef.current && !teamDropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Initial Auth Load & Subscription
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) fetchRole(session.user.id);
            else setIsAuthLoading(false);
        });

        const handleOpenAdminSettingsEvent = (e) => openAdminSettings(e.detail);
        window.addEventListener('openAdminSettings', handleOpenAdminSettingsEvent);

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) fetchRole(session.user.id);
            else {
                setUserRole(null);
                setIsAuthLoading(false);
            }
        });

        return () => {
            subscription.unsubscribe();
            window.removeEventListener('openAdminSettings', handleOpenAdminSettingsEvent);
        };
    }, []);

    const fetchRole = async (userId) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', userId)
                .single();
            if (error) throw error;
            setUserRole(data?.role);
        } catch (error) {
            console.error('Error fetching role:', error);
        } finally {
            setIsAuthLoading(false);
        }
    };

    // Close Team Member dropdown on outside click
    useEffect(() => {
        const handler = (e) => {
            if (teamDropdownRef.current && !teamDropdownRef.current.contains(e.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const currentUserRosterName = React.useMemo(() => {
        if (!session?.user || !teamMembers.length) return null;
        const loggedInEmail = session.user.email?.toLowerCase().trim();
        const loggedInId = session.user.id;
        
        const me = teamMembers.find(m => {
            const hasMatchingEmail = m.email && m.email.toLowerCase().trim() === loggedInEmail;
            const hasMatchingId = m.user_id && m.user_id === loggedInId;
            return hasMatchingEmail || hasMatchingId;
        });
        return me ? me.name : null;
    }, [session, teamMembers]);

    const visibleCategories = React.useMemo(() => {
        if (!categories) return [];
        if (userRole === 'admin' || userRole === 'super_admin') {
            return categories.filter(c => !c.created_by);
        }
        const myId = session?.user?.id;
        return categories.filter(c => !c.created_by || c.created_by === myId);
    }, [categories, userRole, session]);

    const visibleTasks = React.useMemo(() => {
        if (!userRole) return tasks;
        if (userRole === 'super_admin') return tasks.filter(t => t.assigned_by_role !== 'worker');

        const rosterNameSafe = currentUserRosterName?.toLowerCase().trim();

        if (userRole === 'admin') {
            const loggedInId = session?.user?.id;
            
            // Build a set of forbidden assignee IDs (super_admins, and admins who are NOT me)
            const forbiddenProfileIds = new Set(
                profiles
                    .filter(p => p.role === 'super_admin' || (p.role === 'admin' && p.id !== loggedInId))
                    .map(p => p.id)
            );
            
            // Precalculate forbidden names for legacy tasks missing assignee_id
            const forbiddenNamesSafe = new Set(
                teamMembers
                    .filter(m => forbiddenProfileIds.has(m.user_id))
                    .map(m => m.name.toLowerCase().trim())
            );
                
            return tasks.filter(t => {
                // Personal Tasks (created by workers) are hidden from Admin boards
                if (t.assigned_by_role === 'worker') return false;

                // If the task has an explicit assignee_id that is forbidden, hide it.
                if (t.assignee_id && forbiddenProfileIds.has(t.assignee_id)) return false;
                
                // Fallback check against name if assignee_id is somehow missing
                if (t.assignee && !t.assignee_id) {
                    const assigneeSafe = t.assignee.toLowerCase().trim();
                    if (forbiddenNamesSafe.has(assigneeSafe)) return false;
                }
                
                return true;
            });
        }

        if (userRole === 'worker') {
            if (!rosterNameSafe) return []; // If unlinked, see nothing.
            return tasks.filter(t => t.assignee?.toLowerCase().trim() === rosterNameSafe);
        }

        return tasks;
    }, [tasks, userRole, teamMembers, profiles, currentUserRosterName, session?.user?.id]);

    // Derived Display Stats correctly isolated by Role (prevents Admin from seeing Super Admin numbers)
    const displayStats = React.useMemo(() => calculateStats(visibleTasks), [visibleTasks]);

    // Strictly filtered array for the "My Tasks" board
    const myTasks = React.useMemo(() => {
        const rosterNameSafe = currentUserRosterName?.toLowerCase().trim();
        const loggedInId = session?.user?.id;
        
        if (!rosterNameSafe && !loggedInId) return [];
        
        return tasks.filter(t => {
            if (loggedInId && t.assignee_id === loggedInId) return true;
            if (t.assignee && rosterNameSafe && t.assignee.toLowerCase().trim() === rosterNameSafe) return true;
            return false;
        });
    }, [tasks, currentUserRosterName, session?.user?.id]);

    // Calendar Tasks Logic
    const calendarDays = React.useMemo(() => {
        // Filter out completed, deleted, archived, backburner, and missing target_deadline
        let calendarTasks = visibleTasks.filter(t =>
            t.status !== 'Done' &&
            t.status !== 'Deleted' &&
            !t.is_archived &&
            t.priority !== 'Backburner' &&
            t.target_deadline
        );

        // Sort by assignee (ascending), then urgency
        const weightMap = { '1 hr': 1, '6 hrs': 2, 'Today': 3, '3 days': 4, 'This Week': 5, 'This Month': 6 };
        calendarTasks.sort((a, b) => {
            if (a.assignee < b.assignee) return -1;
            if (a.assignee > b.assignee) return 1;
            const weightA = weightMap[a.due_by_type] || 99;
            const weightB = weightMap[b.due_by_type] || 99;
            return weightA - weightB;
        });

        // Group by local date string
        const grouped = {};
        calendarTasks.forEach(t => {
            const dateStr = new Date(t.target_deadline).toLocaleDateString('en-US'); // MM/DD/YYYY format
            if (!grouped[dateStr]) grouped[dateStr] = [];
            grouped[dateStr].push(t);
        });
        return grouped;
    }, [tasks]);

    const sortedTaskDates = React.useMemo(() => {
        return Object.keys(calendarDays).sort((a, b) => new Date(a) - new Date(b));
    }, [calendarDays]);

    const handleNavigateDay = (currentDateStr, direction, isInline = false) => {
        const idx = sortedTaskDates.indexOf(currentDateStr);
        if (idx === -1) return;
        const newIdx = idx + direction;
        if (newIdx >= 0 && newIdx < sortedTaskDates.length) {
            const nextDateStr = sortedTaskDates[newIdx];
            if (isInline) {
                setDayModeDateStr(nextDateStr);
            } else {
                setSelectedDateTasks({
                    date: new Date(nextDateStr),
                    tasks: calendarDays[nextDateStr]
                });
            }
        }
    };

    const touchStartX = React.useRef(null);
    const touchEndX = React.useRef(null);

    const onTouchStart = (e) => {
        touchEndX.current = null;
        touchStartX.current = e.targetTouches[0].clientX;
    };

    const onTouchMove = (e) => {
        touchEndX.current = e.targetTouches[0].clientX;
    };

    const onTouchEnd = (dateStr, isInline = false) => {
        if (!touchStartX.current || !touchEndX.current) return;
        const distance = touchStartX.current - touchEndX.current;
        if (distance > 50) handleNavigateDay(dateStr, 1, isInline);
        if (distance < -50) handleNavigateDay(dateStr, -1, isInline);
    };

    if (loading || isAuthLoading) {
        return (
            <div className="min-h-screen bg-black text-slate-50 flex flex-col items-center justify-center font-sans">
                <Activity className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                <div className="animate-pulse text-blue-400 font-bold tracking-[0.3em] text-sm">
                    {loading ? 'INITIALIZING ROOXTER CORE...' : 'AUTHENTICATING...'}
                </div>
            </div>
        );
    }

    if (!session) {
        return <Login />;
    }

    if (isOnboarding) {
        return <OnboardingGate user={session.user} onComplete={() => setIsOnboarding(false)} />;
    }

    const handleMemberSelect = async (memberOrNew) => {
        setIsDropdownOpen(false);
        if (memberOrNew === 'NEW') {
            const name = prompt("Enter new Team Member name:");
            if (name) {
                const email = prompt(`Enter email for ${name} (optional):`);
                await addTeamMember(name, email ? email.trim() : null);
                setSelectedMember(name);
                setActiveTab('team');
            }
        } else {
            setSelectedMember(memberOrNew.name);
            setActiveTab('team');
        }
    };

    const handleRenameMember = async () => {
        const member = teamMembers.find(m => m.name === selectedMember);
        if (!member) return;
        const newName = prompt("Enter new name for " + selectedMember + ":", selectedMember);
        if (newName && newName !== selectedMember) {
            await updateTeamMember(member.id, newName);
            setSelectedMember(newName);
        }
    };

    const handleDeleteMember = async () => {
        if (confirm(`Are you sure you want to delete ${selectedMember}? All their tasks will be archived.`)) {
            const member = teamMembers.find(m => m.name === selectedMember);
            if (member) {
                await deleteTeamMember(member);
                setSelectedMember(null);
                setActiveTab('dashboard');
            }
        }
    };

    // Category changes are now handled inside the CategoryDropdown component

    // Filter tasks for Modals
    const getModalTasks = () => {
        let filtered = [];
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        switch (modalFilter) {
            case 'P1':
                filtered = visibleTasks.filter(t => t.priority && t.priority.includes('P1') && t.status !== 'Done' && t.status !== 'Deleted' && !t.is_archived);
                break;
            case 'P2':
                filtered = visibleTasks.filter(t => t.priority && t.priority.includes('P2') && t.status !== 'Done' && t.status !== 'Deleted' && !t.is_archived);
                break;
            case 'P3':
                filtered = visibleTasks.filter(t => t.priority && t.priority.includes('P3') && t.status !== 'Done' && t.status !== 'Deleted' && !t.is_archived);
                break;
            case 'Backburner':
                filtered = visibleTasks.filter(t => t.priority === 'Backburner' && t.status !== 'Done' && t.status !== 'Deleted' && !t.is_archived);
                break;
            case 'Completed':
                filtered = visibleTasks.filter(t => {
                    if (t.status !== 'Done') return false;
                    const compDate = t.deletion_date || t.submitted_on || t.created_at || t.date;
                    return new Date(compDate) >= sevenDaysAgo;
                });
                break;
            case 'Overdue':
                filtered = visibleTasks.filter(t => t.status !== 'Done' && t.status !== 'Deleted' && !t.is_archived && t.priority && t.priority.includes('P1') && isTaskOverdue(t.target_deadline));
                break;
            case 'Archive':
                filtered = visibleTasks.filter(t => t.status === 'Done' || t.is_archived);
                break;
            default:
                break;
        }
        return filtered;
    };

    const globalTheme = currentUserProfile?.theme || 'dark';

    return (
        <div className={`min-h-screen bg-black text-slate-50 p-4 md:p-8 pt-12 md:pt-14 font-sans antialiased selection:bg-blue-500/30 theme-${globalTheme} transition-colors duration-500`}>
            {/* GLOBAL TOP HEADER */}
            <div className={`fixed top-0 left-0 right-0 w-full h-06 md:h-08 bg-slate-950/80 backdrop-blur-md border-b border-white/5 z-[60] px-4 md:px-8 flex items-center shadow-lg transition-colors duration-500`}>
                <div className="w-full max-w-7xl mx-auto pl-0 lg:pl-4">
                    <h1 className="text-2xl md:text-3xl font-extralight tracking-widest text-slate-200 logo-text">
                        TASKKER.IO
                    </h1>
                </div>
            </div>

            {/* RIGHT SIDE BAR TOGGLE */}
            <button
                onClick={() => setIsBottomBarOpen(!isBottomBarOpen)}
                className={`fixed top-2 right-5 md:top-3 md:right-6 w-10 h-10 flex items-center justify-center z-[100] bg-slate-800/80 hover:bg-slate-700 backdrop-blur-md border border-slate-700 rounded-xl shadow-xl transition-all hover:scale-105 active:scale-95 group ${isBottomBarOpen ? 'bg-slate-700 shadow-inner' : ''}`}
            >
                <MoreHorizontal className="w-5 h-5 text-slate-300 group-hover:text-white" />
            </button>

            {/* SLIDING RIGHT SIDE BAR OVERLAY */}
            <div
                className={`fixed top-0 bottom-0 right-0 w-20 md:w-24 bg-slate-900/40 backdrop-blur-xl border-l border-slate-700/50 shadow-[-10px_0_40px_rgba(0,0,0,0.5)] z-[90] flex flex-col items-center pt-16 pb-8 px-2 md:px-4 gap-6 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${isBottomBarOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
                <div className="flex flex-col items-center gap-4 shrink-0 overflow-visible w-full">
                    {/* USER PROFILE BUTTON & DROPDOWN */}
                    <div className="relative" ref={profileDropdownRef}>
                        <button
                            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                            className={`w-10 h-10 md:w-12 md:h-12 shrink-0 flex items-center justify-center border rounded-xl md:rounded-2xl transition-colors shadow-lg group relative ${isProfileMenuOpen ? 'bg-emerald-500/30 border-emerald-400 text-emerald-300' : 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400'}`}
                            title="User Profile"
                        >
                            <User className="w-5 h-5 transition-transform duration-300 group-hover:scale-125" />
                            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 md:w-3 md:h-3 bg-emerald-500 border border-[#2b2b36] rounded-full"></div>
                        </button>

                        {isProfileMenuOpen && (
                            <div className="absolute right-full top-0 mr-4 w-48 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-right-4 z-[110]">
                                <div className="p-2 border-b border-white/5 bg-slate-800/50">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase text-center truncate">
                                        {currentUserRosterName || 'My Account'}
                                    </p>
                                </div>
                                <div className="flex flex-col p-1">
                                    <button onClick={() => openSettings('profile')} className="w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-blue-600 hover:text-white rounded-xl transition-colors">
                                        <User className="w-4 h-4" /> Profile
                                    </button>
                                    <button onClick={() => openSettings('preferences')} className="w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-blue-600 hover:text-white rounded-xl transition-colors">
                                        <Settings className="w-4 h-4" /> Preferences
                                    </button>
                                    <div className="h-px bg-slate-800 my-1 mx-2" />
                                    <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-colors">
                                        <LogOut className="w-4 h-4" /> Sign Out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <button className="w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-xl md:rounded-2xl overflow-hidden border-2 border-slate-700 hover:border-slate-500 transition-colors shadow-lg group">
                        <img src={`${import.meta.env.BASE_URL}avatars/RooxterFilms_Avatar.jpg`} alt="RooxterFilms" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                    </button>

                    <button className="w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-xl md:rounded-2xl overflow-hidden border-2 border-slate-700 hover:border-slate-500 transition-colors shadow-lg group">
                        <img src={`${import.meta.env.BASE_URL}avatars/TumbleTech_Avatar.jpg`} alt="TumbleTech" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                    </button>

                    <button className="w-10 h-10 md:w-12 md:h-12 shrink-0 flex items-center justify-center rounded-xl md:rounded-2xl border-2 border-dashed border-slate-700 hover:border-slate-500 hover:bg-slate-800/50 transition-colors shadow-lg group" title="Add Company">
                        <Plus className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
                    </button>
                </div>

                <div className="flex-1 min-h-[20px]"></div>

                {/* FUN BUTTON */}
                <button
                    onClick={() => setIsFunModalOpen(true)}
                    className="w-10 h-10 md:w-12 md:h-12 shrink-0 flex items-center justify-center border border-slate-700/50 rounded-xl md:rounded-2xl transition-all shadow-lg group bg-slate-800/30 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 hover:border-indigo-500/50 mt-auto mb-2"
                    title="FUN BUTTON"
                >
                    <Zap className="w-5 h-5 transition-transform duration-300 group-hover:scale-125" />
                </button>

                {/* ADMIN SYSTEM MODULE BUTTON */}
                <RoleGate allowed={['super_admin', 'admin']} userRole={userRole}>
                    <div className="relative">
                        <button
                            onClick={() => openAdminSettings('Invite Team')}
                            className="w-10 h-10 md:w-12 md:h-12 shrink-0 flex items-center justify-center border border-slate-700 rounded-xl md:rounded-2xl transition-colors shadow-lg group bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-white"
                            title="Admin Module"
                        >
                            <Settings className="w-5 h-5 transition-transform group-hover:rotate-45" />
                        </button>
                    </div>
                </RoleGate>
            </div>

            <div className="max-w-7xl mx-auto relative pl-0 lg:pl-4 transition-transform duration-500">

                {/* Header Section */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2 md:mb-6 gap-6">
                    <div className="flex flex-col items-start w-fit">
                        <div className="flex items-start gap-3">
                            <img src={`${import.meta.env.BASE_URL}avatars/RooxterFilms_Avatar.jpg`} alt="Team Avatar" className="w-11 h-11 md:w-11 md:h-11 object-cover rounded-[14px] border-2 border-blue-500 shadow-sm shadow-blue-500/20" />
                            <div className="flex flex-col items-start leading-none pt-0.5 md:pt-1">
                                <span className="text-slate-300 font-light tracking-widest uppercase text-base md:text-lg leading-none">{companyName || 'TEAM ROOXTER'}</span>
                                <span className="text-slate-100 font-bold tracking-widest uppercase text-[10px] md:text-xs mt-1 md:mt-1.5">{currentUserProfile?.name || currentUserRosterName || currentUserProfile?.first_name || 'GUEST'}</span>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Global Navigation and Add Task Button Wrapper */}
                <div className="flex flex-nowrap items-center gap-1.5 md:gap-2 mb-6 md:mb-8 w-full md:w-auto pb-1 md:pb-0 relative z-40">
                    <nav className="flex flex-nowrap items-center justify-between md:justify-start gap-1 md:gap-2 bg-slate-900/40 backdrop-blur-md border border-slate-800/50 p-1 rounded-2xl relative z-30 min-w-0 flex-1 md:flex-none">
                        <button
                            onClick={() => setActiveTab('dashboard')}
                            className={`flex items-center justify-center gap-1.5 md:gap-2 px-1.5 md:px-4 py-2 rounded-xl font-bold transition-all text-[10px] md:text-xs min-w-0 ${activeTab === 'dashboard'
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                }`}
                        >
                            <LayoutDashboard className="w-3.5 h-3.5 shrink-0" /> <span className="truncate hidden sm:inline-block">Overview</span><span className="truncate sm:hidden">Home</span>
                        </button>

                        <RoleGate userRole={userRole} allowed={['admin', 'super_admin']}>
                            <div className="relative flex items-center min-w-0" ref={teamDropdownRef}>
                                <button
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    className={`flex items-center justify-center gap-1.5 md:gap-2 px-1.5 md:px-4 py-2 rounded-xl font-bold transition-all text-[10px] md:text-xs w-full min-w-0 ${activeTab === 'team'
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                        }`}
                                >
                                    <Users className="w-3.5 h-3.5 shrink-0" />
                                    <span className="truncate max-w-[60px] md:max-w-[120px]">
                                        {(activeTab === 'team' && selectedMember) ? selectedMember : "Team"}
                                    </span>
                                    <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isDropdownOpen && (
                                    <div className="absolute top-[calc(100%+0.5rem)] left-0 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col z-50 animate-in fade-in slide-in-from-top-2">
                                        {teamMembers.map(member => (
                                            <button
                                                key={member.id}
                                                onClick={() => handleMemberSelect(member)}
                                                className="px-4 py-3 text-left text-xs font-semibold text-slate-300 hover:bg-blue-600 hover:text-white transition-colors"
                                            >
                                                {member.name}
                                            </button>
                                        ))}
                                        <div className="h-px bg-slate-800 my-1"></div>
                                        <button
                                            onClick={() => handleMemberSelect('NEW')}
                                            className="px-4 py-3 text-left text-xs font-bold text-blue-400 hover:bg-blue-900/30 transition-colors flex items-center gap-2"
                                        >
                                            <UserPlus className="w-3.5 h-3.5" /> CREATE NEW
                                        </button>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => alert("Board is under construction")}
                                className={`flex items-center justify-center gap-1.5 md:gap-2 px-1.5 md:px-4 py-2 rounded-xl font-bold transition-all text-[10px] md:text-xs min-w-0 ${activeTab === 'board'
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                    }`}
                            >
                                <FolderKanban className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Board</span>
                            </button>
                        </RoleGate>

                        <button
                            onClick={() => setActiveTab('calendar')}
                            className={`flex items-center justify-center gap-1.5 md:gap-2 px-1.5 md:px-4 py-2 rounded-xl font-bold transition-all text-[10px] md:text-xs min-w-0 ${activeTab === 'calendar'
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                }`}
                        >
                            <CalendarDays className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Calendar</span>
                        </button>
                    </nav>

                    <div className="flex gap-2">
                        {userRole !== 'worker' && (
                            <button
                                onClick={() => { setIsPersonalTaskMode(true); setIsGlobalAddTaskOpen(true); }}
                                className="flex items-center justify-center gap-1.5 md:gap-2 px-3 py-2 md:px-5 md:py-2.5 rounded-xl font-bold transition-all text-[10px] md:text-xs text-slate-300 border border-slate-600 hover:bg-slate-700 bg-slate-800 whitespace-nowrap active:scale-95 min-w-0 flex-shrink shadow-lg"
                            >
                                <span className="truncate">Personal Task</span>
                            </button>
                        )}
                        <button
                            onClick={() => { setIsPersonalTaskMode(userRole === 'worker'); setIsGlobalAddTaskOpen(true); }}
                            className={`flex items-center justify-center gap-1.5 md:gap-2 px-3 py-2 md:px-5 md:py-2.5 rounded-xl font-bold transition-all text-[10px] md:text-xs text-white border whitespace-nowrap active:scale-95 min-w-0 flex-shrink shadow-lg ${
                                userRole === 'worker' 
                                ? 'bg-slate-600 hover:bg-slate-500 border-slate-500/50 hover:border-slate-400 shadow-slate-500/20' 
                                : 'bg-blue-600 hover:bg-blue-500 border-blue-500/50 hover:border-blue-400 shadow-blue-500/20'
                            }`}
                        >
                            <span className="truncate">{userRole === 'worker' ? "Personal Task" : "Add Task"}</span>
                        </button>
                    </div>
                </div>

                {/* View: Calendar */}
                {activeTab === 'calendar' && (
                    <div className="glass p-4 md:p-8 rounded-[3rem] animate-in fade-in duration-700">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4 md:mb-8 border-b border-slate-800/50 pb-6 relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 md:gap-4">
                                    <button
                                        onClick={() => setCurrentMonthDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                                        className="p-1 hover:bg-slate-800 rounded-lg transition-colors"
                                    >
                                        <ChevronLeft className="w-6 h-6 md:w-8 md:h-8 text-blue-500" />
                                    </button>
                                    <h2 className="text-xl md:text-3xl font-black tracking-tight uppercase min-w-[140px] md:min-w-[180px] text-center">
                                        {currentMonthDate.toLocaleString('default', { month: 'short' })} {currentMonthDate.getFullYear()}
                                    </h2>
                                    <button
                                        onClick={() => setCurrentMonthDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                                        className="p-1 hover:bg-slate-800 rounded-lg transition-colors"
                                    >
                                        <ChevronRight className="w-6 h-6 md:w-8 md:h-8 text-blue-500" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center bg-slate-900/50 rounded-xl border border-slate-700 p-1">
                                <button
                                    onClick={() => setCalendarMode('day')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${calendarMode === 'day' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    <FileText className="w-4 h-4" /> Day
                                </button>
                                <button
                                    onClick={() => setCalendarMode('week')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${calendarMode === 'week' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    <List className="w-4 h-4" /> Week
                                </button>
                                <button
                                    onClick={() => setCalendarMode('month')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${calendarMode === 'month' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    <CalendarDays className="w-4 h-4" /> Month
                                </button>
                            </div>
                        </div>

                        {/* Calendar Content */}
                        <div className="w-full">
                            {calendarMode === 'day' ? (
                                (() => {
                                    const dateStrToShow = dayModeDateStr || sortedTaskDates.find(d => new Date(d) >= new Date()) || sortedTaskDates[0] || new Date().toLocaleDateString('en-US');
                                    const tasksToShow = calendarDays[dateStrToShow] || [];
                                    const dayDate = new Date(dateStrToShow);

                                    return (
                                        <div
                                            className="w-full flex flex-col items-center justify-center py-4"
                                            onTouchStart={onTouchStart}
                                            onTouchMove={onTouchMove}
                                            onTouchEnd={() => onTouchEnd(dateStrToShow, true)}
                                        >
                                            <div className="mb-8 flex items-center justify-center gap-4 text-center w-full">
                                                <button
                                                    onClick={() => handleNavigateDay(dateStrToShow, -1, true)}
                                                    className={`p-2 transition-colors ${sortedTaskDates.indexOf(dateStrToShow) > 0 ? 'text-blue-500 hover:text-white hover:bg-slate-800 rounded-lg' : 'text-slate-700 cursor-not-allowed opacity-30'}`}
                                                >
                                                    <ChevronLeft className="w-8 h-8 md:w-10 md:h-10" />
                                                </button>
                                                <h3 className="text-xl md:text-3xl font-light text-slate-300 tracking-wider">
                                                    {dayDate.toLocaleDateString('en-US', { weekday: 'long' })} - {dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </h3>
                                                <button
                                                    onClick={() => handleNavigateDay(dateStrToShow, 1, true)}
                                                    className={`p-2 transition-colors ${sortedTaskDates.indexOf(dateStrToShow) < sortedTaskDates.length - 1 ? 'text-blue-500 hover:text-white hover:bg-slate-800 rounded-lg' : 'text-slate-700 cursor-not-allowed opacity-30'}`}
                                                >
                                                    <ChevronRight className="w-8 h-8 md:w-10 md:h-10" />
                                                </button>
                                            </div>

                                            <div className="flex flex-col gap-4 w-full max-w-2xl px-2">
                                                {tasksToShow.length > 0 ? tasksToShow.map(calendarTask => {
                                                    const liveTask = tasks.find(t => t.id === calendarTask.id);
                                                    if (!liveTask) return null;
                                                    return (
                                                        <TaskCard userRole={userRole}
                                                            key={liveTask.id}
                                                            task={liveTask}
                                                            updateTask={updateTask}
                                                            categories={visibleCategories}
                                                            addCategory={addCategory}
                                                            deleteCategory={deleteCategory}
                                                            deleteTask={deleteTask}
                                                            showAssignee={true}
                                                        />
                                                    );
                                                }) : (
                                                    <div className="text-center py-20 text-slate-500 italic">No tasks assigned for this day.</div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()
                            ) : (
                                <div className="grid grid-cols-7 gap-1 md:gap-2">
                                    {/* Headers */}
                                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                        <div key={day} className="text-center text-[10px] md:text-xs font-black uppercase text-slate-500 py-1 md:py-2 border-b border-slate-700">
                                            <span className="md:hidden">{day.substring(0, 1)}</span>
                                            <span className="hidden md:inline">{day}</span>
                                        </div>
                                    ))}

                                    {/* Generate current month cells based on mode */}
                                    {(() => {
                                        const firstDay = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 1);
                                        const offset = firstDay.getDay();
                                        const daysInMonth = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 0).getDate();
                                        const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;

                                        if (calendarMode === 'week') {
                                            // WEEK / FLOW LAYOUT
                                            const weeks = [];
                                            for (let i = 0; i < totalCells; i += 7) {
                                                const weekCells = Array.from({ length: 7 }).map((_, j) => i + j);

                                                // Check if this week has any tasks
                                                const hasTasks = weekCells.some(cellIdx => {
                                                    const dateCount = cellIdx - offset + 1;
                                                    const isCurrentMonth = dateCount > 0 && dateCount <= daysInMonth;
                                                    if (!isCurrentMonth) return false;

                                                    const cellDate = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), dateCount);
                                                    const dateStr = cellDate.toLocaleDateString('en-US');
                                                    return calendarDays[dateStr] && calendarDays[dateStr].length > 0;
                                                });

                                                if (hasTasks) {
                                                    weeks.push(weekCells);
                                                }
                                            }

                                            if (weeks.length === 0) {
                                                return (
                                                    <div className="col-span-7 flex flex-col items-center justify-center py-20 text-slate-500">
                                                        <CalendarDays className="w-12 h-12 mb-4 opacity-20" />
                                                        <p className="italic">No tasks scheduled for this month.</p>
                                                    </div>
                                                );
                                            }

                                            return weeks.map((week, weekIdx) => (
                                                <React.Fragment key={weekIdx}>
                                                    {week.map((cellIdx) => {
                                                        const dateCount = cellIdx - offset + 1;
                                                        const isCurrentMonth = dateCount > 0 && dateCount <= daysInMonth;

                                                        if (!isCurrentMonth) {
                                                            return <div key={cellIdx} className="p-1 md:p-2 border border-transparent flex flex-col bg-transparent min-h-[100px] border-b border-slate-800/30"></div>;
                                                        }

                                                        const cellDate = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), dateCount);
                                                        const dateStr = cellDate.toLocaleDateString('en-US');
                                                        const dayTasks = calendarDays[dateStr] ? calendarDays[dateStr] : [];
                                                        const isToday = cellDate.toDateString() === new Date().toDateString();

                                                        return (
                                                            <div key={cellIdx}
                                                                onClick={() => { if (dayTasks.length > 0) setSelectedDateTasks({ date: cellDate, tasks: dayTasks }); }}
                                                                className={`relative pt-6 px-1 pb-4 md:px-2 md:pb-6 border-b border-slate-800/30 flex flex-col bg-transparent group overflow-visible transition-colors hover:bg-slate-800/20 min-h-[100px] ${dayTasks.length > 0 ? 'cursor-pointer' : ''}`}
                                                            >
                                                                <div className={`absolute top-2 left-2 w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded-full text-xs md:text-sm font-black ${isToday ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50' : 'text-slate-300 group-hover:text-blue-400'}`}>
                                                                    {dateCount}
                                                                </div>
                                                                <div className="flex-1 flex flex-col mt-2">
                                                                    {dayTasks.map(task => (
                                                                        <div
                                                                            key={task.id}
                                                                            className={`shrink-0 transition-all hover:scale-[1.02]
                                                                            h-1.5 w-full rounded-full mb-1
                                                                            md:h-auto md:w-auto md:rounded-md md:mb-1.5
                                                                            md:text-[10px] md:leading-[1.2] md:px-2 md:py-1 md:font-semibold md:border md:bg-slate-900 md:shadow-sm
                                                                            ${task.priority?.includes('P1') ? 'bg-red-500 md:bg-slate-900 md:border-red-500/30 md:text-red-200' :
                                                                                    task.priority?.includes('P2') ? 'bg-orange-500 md:bg-slate-900 md:border-orange-500/30 md:text-orange-200' :
                                                                                        task.priority?.includes('P3') ? 'bg-yellow-500 md:bg-slate-900 md:border-yellow-500/30 md:text-yellow-200' :
                                                                                            'bg-slate-500 md:bg-slate-900 md:border-slate-500/30 md:text-slate-200'}`}
                                                                            title={task.action}
                                                                        >
                                                                            <div className="hidden md:block truncate">{task.action}</div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </React.Fragment>
                                            ));
                                        } else {
                                            // GRID / MONTH LAYOUT
                                            return Array.from({ length: totalCells }).map((_, i) => {
                                                const dateCount = i - offset + 1;
                                                const isCurrentMonth = dateCount > 0 && dateCount <= daysInMonth;

                                                if (!isCurrentMonth) {
                                                    return <div key={i} className="min-h-[60px] md:min-h-[120px] p-1 md:p-2 border border-transparent rounded-lg md:rounded-xl flex flex-col bg-transparent"></div>;
                                                }

                                                const cellDate = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), dateCount);
                                                const dateStr = cellDate.toLocaleDateString('en-US');
                                                const dayTasks = calendarDays[dateStr] ? calendarDays[dateStr] : [];

                                                const isToday = cellDate.toDateString() === new Date().toDateString();

                                                return (
                                                    <div key={i}
                                                        onClick={() => { if (dayTasks.length > 0) setSelectedDateTasks({ date: cellDate, tasks: dayTasks }); }}
                                                        className={`min-h-[60px] md:min-h-[120px] h-[60px] md:h-[120px] relative pt-5 md:pt-6 px-1 pb-1 md:px-2 md:pb-2 border border-slate-800/50 rounded-lg md:rounded-xl flex flex-col bg-slate-900/30 overflow-hidden transition-colors ${dayTasks.length > 0 ? 'cursor-pointer hover:bg-slate-800/40 hover:border-slate-600' : ''}`}
                                                    >
                                                        <div className={`absolute top-1 left-1 w-4 h-4 md:w-5 md:h-5 flex items-center justify-center rounded-sm text-[8px] md:text-[10px] font-bold ${isToday ? 'bg-blue-400/20 text-blue-400' : 'text-slate-500'}`}>
                                                            {dateCount}
                                                        </div>
                                                        <div className="flex-1 flex flex-col overflow-y-auto no-scrollbar">
                                                            {dayTasks.map(task => (
                                                                <div
                                                                    key={task.id}
                                                                    className={`shrink-0 transition-all hover:scale-[1.02]
                                                                    h-1 w-full rounded-full mb-0.5
                                                                    md:h-auto md:w-auto md:rounded md:mb-1
                                                                    md:text-[9px] md:leading-tight md:px-1.5 md:py-0.5 md:font-semibold md:border md:bg-slate-800/80
                                                                    ${task.priority?.includes('P1') ? 'bg-red-500 md:bg-transparent md:border-red-500/50 md:text-red-200' :
                                                                            task.priority?.includes('P2') ? 'bg-orange-500 md:bg-transparent md:border-orange-500/50 md:text-orange-200' :
                                                                                task.priority?.includes('P3') ? 'bg-yellow-500 md:bg-transparent md:border-yellow-500/50 md:text-yellow-200' :
                                                                                    'bg-slate-500 md:bg-transparent md:border-slate-500/50 md:text-slate-200'}`}
                                                                    title={task.action}
                                                                >
                                                                    <div className="hidden md:block truncate">{task.action}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        }
                                    })()}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* View: Dashboard */}
                {activeTab === 'dashboard' && (
                    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="flex w-full gap-2 md:gap-4 overflow-hidden">
                            <StatCard label="BACKBURNER" shortLabel="BACKBURNER" value={displayStats.backburner} icon={Coffee} color="text-slate-400" bgColor="bg-slate-400/10" onClick={() => setModalFilter('Backburner')} />
                            <StatCard label="P3 (LOW)" shortLabel="P3" value={displayStats.p3} icon={Calendar} color="text-yellow-500" bgColor="bg-yellow-500/10" onClick={() => setModalFilter('P3')} />
                            <StatCard label="P2 (NORMAL)" shortLabel="P2" value={displayStats.p2} icon={AlertTriangle} color="text-orange-500" bgColor="bg-orange-500/10" onClick={() => setModalFilter('P2')} />
                            <StatCard label="P1 (HIGH)" shortLabel="P1" value={displayStats.p1} icon={Zap} color="text-red-500" bgColor="bg-red-500/10" onClick={() => setModalFilter('P1')} />
                            <StatCard label="Done (7 Days)" shortLabel="DONE" value={displayStats.completed} icon={CheckCircle2} color="text-emerald-500" bgColor="bg-emerald-500/10" onClick={() => setModalFilter('Completed')} />
                        </div>

                        {/* Unified All Tasks / Production Board Container */}
                        <RoleGate userRole={userRole} allowed={['admin', 'super_admin']}>
                            <div className={`glass w-full mt-2 transition-all duration-500 overflow-hidden border border-slate-700/50 shadow-lg ${showAllTasksBoard ? 'rounded-[2.5rem] shadow-2xl pb-8' : 'rounded-[2rem]'}`}>

                                {/* Header Toggle Button */}
                                <div
                                    onClick={() => setShowAllTasksBoard(!showAllTasksBoard)}
                                    className={`w-full flex items-center justify-between px-8 transition-all hover:bg-slate-800/50 cursor-pointer group ${showAllTasksBoard ? 'py-4 border-b border-white/5' : 'py-4'}`}
                                >
                                    <span className={`uppercase transition-all ${showAllTasksBoard ? 'text-base md:text-lg font-light tracking-[0.3em] text-slate-300' : 'text-xs md:text-sm font-medium tracking-widest text-slate-500 group-hover:text-slate-300'}`}>
                                        {showAllTasksBoard ? 'SHOW ALL TASKS' : 'SHOW ALL TASKS'}
                                    </span>
                                    <div className="flex items-center gap-4">
                                        {showAllTasksBoard && (
                                            <select
                                                value={allTasksCategoryFilter}
                                                onChange={(e) => setAllTasksCategoryFilter(e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                onPointerDown={(e) => e.stopPropagation()}
                                                className="bg-slate-800/80 border border-slate-700 text-slate-300 text-[10px] sm:text-xs font-bold rounded-xl px-2 py-1.5 sm:px-4 sm:py-2 outline-none cursor-pointer hover:bg-slate-700 transition-colors shadow-inner"
                                            >
                                                <option value="All">All Categories</option>
                                                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                            </select>
                                        )}
                                        <ChevronDown className={`w-5 h-5 transition-transform duration-500 text-slate-500 group-hover:text-slate-300 ${showAllTasksBoard ? 'rotate-180' : ''}`} />
                                    </div>
                                </div>

                                {/* Board Content */}
                                {showAllTasksBoard && (
                                    <div className="px-8 pt-4 pb-2 animate-in fade-in duration-500">
                                        <AllTasksBoard tasks={visibleTasks} userRole={userRole} categoryFilter={allTasksCategoryFilter} updateTask={updateTask} categories={visibleCategories} addCategory={addCategory} deleteCategory={deleteCategory} deleteTask={deleteTask} kanbanEnabled={userSettings?.dnd_desktop_enabled} />
                                    </div>
                                )}
                            </div>
                        </RoleGate>

                        {/* Unified My Tasks Board Container */}
                        <div className={`glass w-full mt-2 transition-all duration-500 overflow-hidden border border-slate-700/50 shadow-lg ${showMyTasksBoard ? 'rounded-[2.5rem] shadow-2xl pb-8' : 'rounded-[2rem]'}`}>
                            <button
                                onClick={() => setShowMyTasksBoard(!showMyTasksBoard)}
                                className={`w-full flex items-center justify-between px-8 transition-all hover:bg-slate-800/50 cursor-pointer group ${showMyTasksBoard ? 'py-4 border-b border-white/5' : 'py-4'}`}
                            >
                                <div className="flex items-center gap-4 relative">
                                    <span className={`uppercase transition-all ${showMyTasksBoard ? 'text-base md:text-lg font-light tracking-[0.3em] text-slate-300' : 'text-xs md:text-sm font-medium tracking-widest text-slate-500 group-hover:text-slate-300'}`}>
                                        MY TASKS
                                    </span>
                                    {myTasks.filter(t => t.is_notified && !['Done', 'Deleted'].includes(t.status)).length > 0 && (
                                        <div className="flex items-center justify-center bg-red-500 text-white text-[10px] font-black rounded-lg px-2 py-0.5 shadow-lg relative">
                                            {myTasks.filter(t => t.is_notified && !['Done', 'Deleted'].includes(t.status)).length}!
                                            {/* Pointer Triangle */}
                                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-red-500"></div>
                                        </div>
                                    )}
                                </div>
                                <ChevronDown className={`w-5 h-5 transition-transform duration-500 text-slate-500 group-hover:text-slate-300 ${showMyTasksBoard ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Board Content */}
                            {showMyTasksBoard && (
                                <div className="px-8 pt-4 pb-2 animate-in fade-in duration-500">
                                    <AllTasksBoard tasks={myTasks} userRole={userRole} categoryFilter="All" updateTask={updateTask} categories={visibleCategories} addCategory={addCategory} deleteCategory={deleteCategory} deleteTask={deleteTask} kanbanEnabled={userSettings?.dnd_desktop_enabled} />
                                </div>
                            )}
                        </div>

                        <RoleGate userRole={userRole} allowed={['admin', 'super_admin']}>
                            <div className="col-span-full glass p-4 md:p-5 rounded-2xl mt-4 border border-slate-700/50 flex flex-col gap-3">
                                <div className="flex items-center gap-4 flex-wrap">
                                    <h3 className="uppercase transition-all text-xs md:text-sm font-medium tracking-widest text-slate-500 shrink-0">ACTIVE TEAM ROSTER</h3>
                                    
                                    {/* Permanently Open Search Pill */}
                                    <div className="flex-1 max-w-[200px] relative">
                                        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            placeholder="Search names..."
                                            value={rosterSearchQuery}
                                            onChange={(e) => setRosterSearchQuery(e.target.value)}
                                            className="w-full bg-slate-900/50 border border-slate-700/50 hover:border-slate-500 rounded-full py-1.5 pl-9 pr-4 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                                        />
                                    </div>
                                </div>
                                
                                <div className="flex flex-wrap gap-4 md:gap-6 mt-1">
                                    {teamMembers.length === 0 ? (
                                        <span className="text-slate-500 italic text-xs">No team members initialized. Check Admin Tools to invite members.</span>
                                    ) : (
                                        teamMembers
                                            .filter(m => {
                                                if (!rosterSearchQuery) return true;
                                                const query = rosterSearchQuery.toLowerCase();
                                                return m.name.toLowerCase().split(' ').some(part => part.startsWith(query));
                                            })
                                            .map(m => (
                                                <div key={m.id} onClick={() => handleMemberSelect(m)} className="cursor-pointer text-xs font-mono text-blue-300/60 hover:text-blue-400 transition-colors">
                                                    {m.name}
                                                </div>
                                            ))
                                    )}
                                    {teamMembers.length > 0 && rosterSearchQuery && teamMembers.filter(m =>
                                        m.name.toLowerCase().split(' ').some(part => part.startsWith(rosterSearchQuery.toLowerCase()))
                                    ).length === 0 && (
                                        <span className="text-slate-500 italic text-xs">No team members match "{rosterSearchQuery}".</span>
                                    )}
                                </div>
                            </div>
                        </RoleGate>

                        {userRole && (
                            <div className="w-full text-center mt-4 mb-2 flex justify-center">
                                <span className="text-[10px] text-slate-500 opacity-60 uppercase font-mono tracking-widest">
                                    {userRole} mode
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* View: Team Member (Active Sprint) */}
                {activeTab === 'team' && selectedMember && (
                    <div className="animate-in fade-in zoom-in-95 duration-500">
                        <div className="flex flex-row justify-between items-center mb-6 px-2 md:px-4 gap-2">
                            <div className="min-w-0 pr-2">
                                <div className="flex items-center gap-2 md:gap-4 flex-wrap">
                                    <h2 className="text-2xl md:text-3xl font-black text-white truncate">{selectedMember}</h2>
                                    <div className="flex gap-1 md:gap-2 shrink-0">
                                        <button onClick={handleRenameMember} className="p-1 md:p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors">
                                            <Pencil className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                        </button>
                                        <button onClick={handleDeleteMember} className="p-1 md:p-1.5 bg-slate-800 hover:bg-red-900/50 rounded-lg text-slate-400 hover:text-red-400 transition-colors">
                                            <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => addTask(selectedMember, userRole)}
                                className="shrink-0 bg-blue-600 hover:bg-blue-500 flex items-center justify-center gap-1.5 md:gap-2 px-3 py-2 md:px-6 md:py-3 rounded-lg md:rounded-xl font-bold transition-all active:scale-95 shadow-xl shadow-blue-900/20 group whitespace-nowrap text-xs md:text-sm"
                            >
                                Add Task
                            </button>
                        </div>

                        <div className="glass rounded-[2.5rem] border border-white/5 min-h-[450px]">
                            <div className="overflow-visible no-scrollbar">
                                {/* Desktop Table */}
                                <div className="hidden md:block">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-900/30 border-b border-white/5 text-slate-500 text-[10px] uppercase tracking-[0.2em]">
                                                <th className="px-4 py-3 font-bold whitespace-nowrap">STATUS</th>
                                                <th className="px-4 py-3 font-bold whitespace-nowrap">TASKS</th>
                                                <th className="px-4 py-3 font-bold whitespace-nowrap">CATEGORY</th>
                                                <th className="px-4 py-3 font-bold whitespace-nowrap">DUE BY</th>
                                                {['admin', 'super_admin'].includes(userRole) && (
                                                    <>
                                                        <th className="px-4 py-3 font-bold text-center whitespace-nowrap">NOTIFY</th>
                                                        <th className="px-4 py-3 font-bold text-center whitespace-nowrap">NOTES</th>
                                                    </>
                                                )}
                                                <th className="px-4 py-3 font-bold text-center whitespace-nowrap">DELETE</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {visibleTasks
                                                .filter(t => t.assignee === selectedMember && t.status !== 'Deleted' && t.status !== 'Done' && !t.is_archived)
                                                .map(task => (
                                                    <TaskRow
                                                        key={task.id}
                                                        task={task}
                                                        updateTask={updateTask}
                                                        categories={visibleCategories}
                                                        addCategory={addCategory}
                                                        deleteCategory={deleteCategory}
                                                        deleteTask={deleteTask}
                                                        showAssignee={false}
                                                        userRole={userRole}
                                                    />
                                                ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile Cards */}
                                <div className="md:hidden flex flex-col gap-4 p-4">
                                    {visibleTasks
                                        .filter(t => t.assignee === selectedMember && t.status !== 'Deleted' && t.status !== 'Done' && !t.is_archived)
                                        .map(task => (
                                            <TaskCard userRole={userRole}
                                                key={task.id}
                                                task={task}
                                                updateTask={updateTask}
                                                categories={visibleCategories}
                                                addCategory={addCategory}
                                                deleteCategory={deleteCategory}
                                                deleteTask={deleteTask}
                                                showAssignee={false}
                                            />
                                        ))}
                                </div>
                                {visibleTasks.filter(t => t.assignee === selectedMember && t.status !== 'Deleted' && t.status !== 'Done' && !t.is_archived).length === 0 && (
                                    <div className="p-20 text-center text-slate-600 font-bold italic tracking-tighter text-2xl">
                                        SYSTEM CLEAR. NO ACTIVE ITEMS FOR {selectedMember?.toUpperCase()}.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}



            </div>

            {/* MODAL OVERLAY */}
            {
                modalFilter && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setModalFilter(null)}></div>
                        <div className="relative glass w-full max-w-4xl rounded-[2.5rem] border border-white/10 p-8 shadow-2xl animate-in zoom-in-95 duration-200">

                            {/* Action Corner: Toggles and Close */}
                            <div className="absolute top-6 right-6 flex items-center gap-3 z-10">

                                <button
                                    onClick={() => setModalFilter(null)}
                                    className="p-2 bg-slate-800/50 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <h2 className="text-2xl font-black mb-6 tracking-widest uppercase flex items-center gap-3">
                                <span className={
                                    modalFilter === 'Completed' ? 'text-emerald-500' :
                                        modalFilter === 'P1' ? 'text-red-500' :
                                            modalFilter === 'P2' ? 'text-orange-500' :
                                                modalFilter === 'P3' ? 'text-yellow-500' :
                                                    'text-white'
                                }>
                                    {modalFilter === 'Completed' ? 'COMPLETED (7 days)' :
                                        modalFilter === 'Archive' ? 'SYSTEM ARCHIVE' :
                                            modalFilter === 'Backburner' ? 'BACKBURNER' :
                                                modalFilter}
                                </span>
                                <span className={`${modalFilter === 'Completed' ? 'bg-emerald-500' : modalFilter === 'Archive' ? 'bg-slate-600' : 'bg-blue-600'} text-white text-xs px-3 py-1 rounded-full`}>
                                    {getModalTasks().length}
                                </span>
                            </h2>

                            <div className="overflow-x-auto no-scrollbar max-h-[60vh]">
                                <div className="w-full max-w-5xl overflow-x-auto no-scrollbar max-h-[70vh]">
                                    <table className="w-full text-left border-collapse min-w-[600px]">
                                        <thead className="sticky top-0 bg-slate-900/90 backdrop-blur-md z-10 before:absolute before:inset-0 before:-z-10 before:shadow-md">
                                            <tr className="border-b border-white/5 text-slate-500 text-[9px] md:text-xs uppercase tracking-widest font-bold whitespace-nowrap">
                                                <th className="px-3 md:px-4 py-3 md:py-4">Team</th>
                                                <th className="px-3 md:px-4 py-3 md:py-4 w-1/3">Tasks</th>
                                                <th className="px-3 md:px-4 py-3 md:py-4">Category</th>
                                                {modalFilter !== 'Archive' && (
                                                    <>
                                                        <th className="px-3 md:px-4 py-3 md:py-4">Due By</th>
                                                        <th className="px-3 md:px-4 py-3 md:py-4 text-center">Done</th>
                                                    </>
                                                )}
                                                <th className="px-3 md:px-4 py-3 md:py-4">Submitted On</th>
                                                <th className="px-2 md:px-4 py-3 md:py-4 w-10 text-right">
                                                    {(modalFilter === 'Completed' || modalFilter === 'Archive') && (
                                                        <button
                                                            onClick={() => setModalFilter(modalFilter === 'Completed' ? 'Archive' : 'Completed')}
                                                            className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-emerald-500 hover:text-emerald-400 rounded-lg transition-all border border-slate-700/50 flex items-center justify-center ml-auto"
                                                            title={modalFilter === 'Completed' ? 'View Archive' : 'View Completed'}
                                                        >
                                                            {modalFilter === 'Completed' ? <Archive className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
                                                        </button>
                                                    )}
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {getModalTasks().map(task => {
                                                const isOverdue = isTaskOverdue(task.target_deadline) && task.status !== 'Done' && task.priority && task.priority.includes('P1');
                                                return (
                                                    <tr key={task.id} className={`hover:bg-slate-800/30 transition-colors group relative overflow-hidden ${isOverdue ? 'bg-red-900/10' : ''}`}>
                                                        <td className="px-3 md:px-4 py-3 md:py-4 text-xs md:text-sm font-light text-slate-300 relative z-10 w-[15%]">
                                                            {isOverdue && (
                                                                <div className="absolute inset-0 z-0 flex items-center justify-center opacity-[0.03] pointer-events-none overflow-hidden w-full h-full min-w-[600px] left-0 right-0">
                                                                    <span className="text-red-500 font-black text-6xl md:text-8xl tracking-widest -rotate-12 whitespace-nowrap pl-48">OVERDUE</span>
                                                                </div>
                                                            )}
                                                            <span className="relative z-10">{task.assignee || 'N/A'}</span>
                                                        </td>
                                                        <td className="px-3 md:px-4 py-3 md:py-4 text-xs md:text-sm font-light text-slate-300 relative z-10 w-1/3 whitespace-normal">
                                                            {task.action}
                                                        </td>
                                                        <td className="px-3 md:px-4 py-3 md:py-4 text-xs md:text-sm font-light text-slate-300 relative z-10 w-[15%]">
                                                            {task.category || '-'}
                                                        </td>
                                                        {modalFilter !== 'Archive' && (
                                                            <>
                                                                <td className="px-3 md:px-4 py-3 md:py-4 text-xs md:text-sm font-light text-slate-300 relative z-10 w-[15%]">
                                                                    <span>{task.due_by_type || 'None'}</span>
                                                                </td>
                                                                <td className="px-3 md:px-4 py-3 md:py-4 text-center relative z-10 w-[10%]">
                                                                    <DoneCheckbox task={task} updateTask={updateTask} className="w-5 h-5 mx-auto shrink-0" />
                                                                </td>
                                                            </>
                                                        )}
                                                        <td className="px-3 md:px-4 py-3 md:py-4 text-xs md:text-sm font-light text-slate-300 relative z-10 w-[15%]">
                                                            {formatDate(task.submitted_on || task.created_at)}
                                                        </td>
                                                        <td className="px-1 md:px-4 py-3 md:py-4 text-right relative z-10 w-[5%] pr-2">
                                                            <button
                                                                onClick={() => permanentlyDeleteTask(task.id)}
                                                                className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 transition-all transform hover:scale-125 focus:opacity-100 flex items-center ml-auto"
                                                                title="Delete Permanently"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {getModalTasks().length === 0 && (
                                                <tr>
                                                    <td colSpan={modalFilter === 'Archive' ? '5' : '7'} className="px-4 py-12 text-center text-slate-600 italic text-sm font-light">No tasks found matching this filter.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* CALENDAR DATE TASKS POPUP MODAL */}
            {
                selectedDateTasks && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedDateTasks(null)}></div>
                        <div
                            className="relative w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200"
                            onTouchStart={onTouchStart}
                            onTouchMove={onTouchMove}
                            onTouchEnd={() => onTouchEnd(selectedDateTasks.date.toLocaleDateString('en-US'))}
                        >
                            <button
                                onClick={() => setSelectedDateTasks(null)}
                                className="absolute -top-12 right-0 p-2 bg-slate-800/50 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors z-[70]"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="mb-4 flex items-center justify-center gap-4 text-center">
                                <button
                                    onClick={() => handleNavigateDay(selectedDateTasks.date.toLocaleDateString('en-US'), -1)}
                                    className={`p-1 transition-colors ${sortedTaskDates.indexOf(selectedDateTasks.date.toLocaleDateString('en-US')) > 0 ? 'text-blue-500 hover:text-white hover:bg-slate-800 rounded-lg' : 'text-slate-700 cursor-not-allowed opacity-30'}`}
                                >
                                    <ChevronLeft className="w-6 h-6 md:w-8 md:h-8" />
                                </button>
                                <h3 className="text-lg md:text-xl font-light text-slate-300 tracking-wider">
                                    {selectedDateTasks.date.toLocaleDateString('en-US', { weekday: 'long' })} - {selectedDateTasks.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </h3>
                                <button
                                    onClick={() => handleNavigateDay(selectedDateTasks.date.toLocaleDateString('en-US'), 1)}
                                    className={`p-1 transition-colors ${sortedTaskDates.indexOf(selectedDateTasks.date.toLocaleDateString('en-US')) < sortedTaskDates.length - 1 ? 'text-blue-500 hover:text-white hover:bg-slate-800 rounded-lg' : 'text-slate-700 cursor-not-allowed opacity-30'}`}
                                >
                                    <ChevronRight className="w-6 h-6 md:w-8 md:h-8" />
                                </button>
                            </div>

                            <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto no-scrollbar pb-4 px-2">
                                {selectedDateTasks.tasks.map(calendarTask => {
                                    // Find the live task from state to ensure it updates when edited
                                    const liveTask = tasks.find(t => t.id === calendarTask.id);
                                    if (!liveTask) return null;
                                    return (
                                        <TaskCard
                                            key={liveTask.id}
                                            task={liveTask}
                                            updateTask={updateTask}
                                            categories={visibleCategories}
                                            addCategory={addCategory}
                                            deleteCategory={deleteCategory}
                                            deleteTask={(id) => {
                                                deleteTask(id);
                                                // Handle closing the modal if no tasks are left
                                                const remainingTasks = selectedDateTasks.tasks.filter(t => t.id !== id);
                                                if (remainingTasks.length === 0) {
                                                    setSelectedDateTasks(null);
                                                } else {
                                                    setSelectedDateTasks({
                                                        ...selectedDateTasks,
                                                        tasks: remainingTasks
                                                    });
                                                }
                                            }}
                                            showAssignee={true}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Global Add Task Modal */}
            <GlobalAddTaskModal
                isOpen={isGlobalAddTaskOpen}
                isPersonalMode={isPersonalTaskMode}
                onClose={() => setIsGlobalAddTaskOpen(false)}
                userRole={userRole}
                currentUserRosterName={currentUserRosterName}
                teamMembers={teamMembers}
                profiles={profiles}
                categories={visibleCategories}
                addTask={addTask}
                updateTask={updateTask}
                addCategory={addCategory}
                deleteCategory={deleteCategory}
            />

            {/* Settings Modal */}
            <SettingsModal 
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
                initialTab={settingsModalTab}
                currentUserRosterName={currentUserRosterName}
                currentUserProfile={currentUserProfile}
                teamMembers={teamMembers}
                updateTeamMember={updateTeamMember}
                updateProfileDetails={updateProfileDetails}
                updateProfileTheme={updateProfileTheme}
                userRole={userRole}
                rewards={rewards}
                userSettings={userSettings}
                updateUserSetting={updateUserSetting}
            />

            {/* Admin Settings Modal */}
            <AdminSettingsModal
                isOpen={isAdminModalOpen}
                onClose={() => setIsAdminModalOpen(false)}
                initialTab={adminModalTab}
                userRole={userRole}
                profiles={profiles}
                teamMembers={teamMembers}
                updateProfileRole={updateProfileRole}
                terminateProfile={terminateProfile}
                rewards={rewards}
                updateReward={updateReward}
                session={session}
                companyName={companyName}
                updateCompanyName={updateCompanyName}
                categories={categories}
                addCategory={addCategory}
                updateCategory={updateCategory}
                deleteCategory={deleteCategory}
            />

            {/* PATCH NOTES MODAL */}
            <PatchNotesModal isOpen={isPatchNotesOpen} onClose={() => setIsPatchNotesOpen(false)} />

            {/* FUN POPUP MODAL */}
            {isFunModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-slate-900 border border-slate-700/50 rounded-3xl p-8 max-w-sm w-full shadow-2xl relative flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
                        <button
                            onClick={() => setIsFunModalOpen(false)}
                            className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors p-1"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        
                        <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mb-6">
                            <Zap className="w-8 h-8 text-yellow-500" />
                        </div>
                        
                        <p className="text-sm text-slate-300 mb-8 leading-relaxed font-medium">
                            This is the fun panel! - the idea is you can send nudges, icons and other fun whatnots to people. For now, this is placeholder.
                        </p>
                        
                        <div className="flex gap-4 justify-center">
                            <button className="w-12 h-12 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 rounded-xl flex items-center justify-center transition-all hover:scale-110 group">
                                <Zap className="w-5 h-5 text-yellow-400 group-hover:scale-110 transition-transform" />
                            </button>
                            <button className="w-12 h-12 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 rounded-xl flex items-center justify-center transition-all hover:scale-110 group">
                                <Flame className="w-5 h-5 text-orange-500 group-hover:scale-110 transition-transform" />
                            </button>
                            <button className="w-12 h-12 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 rounded-xl flex items-center justify-center transition-all hover:scale-110 group">
                                <ThumbsUp className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" />
                            </button>
                            <button className="w-12 h-12 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 rounded-xl flex items-center justify-center transition-all hover:scale-110 group">
                                <Bell className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                            </button>
                            <button className="w-12 h-12 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 rounded-xl flex items-center justify-center transition-all hover:scale-110 group">
                                <PartyPopper className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Versioning */}
            <button 
                onClick={() => setIsPatchNotesOpen(true)}
                className="fixed bottom-2 right-2 text-[10px] font-thin text-white/50 hover:text-white transition-colors cursor-pointer z-[60]"
            >
                v{import.meta.env.VITE_APP_VERSION}
            </button>

            {/* Styles Injection */}
            <style>{`
        .glass {
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        @keyframes fade-in {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-in {
            animation: fade-in 0.5s ease-out forwards;
        }
      `}</style>
        </div >
    );
}

// --- Updated Category Dropdown Component ---
function CategoryDropdown({ categories, value, onSelect, onAdd, onDelete, readOnly, userRole, isPrivateContext }) {
    const [isOpen, setIsOpen] = React.useState(false);
    const [isCreating, setIsCreating] = React.useState(false);
    const [newName, setNewName] = React.useState('');
    const ref = React.useRef(null);

    // Close on outside click
    React.useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                setIsOpen(false);
                setIsCreating(false);
                setNewName('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleAdd = async () => {
        const trimmed = newName.trim();
        if (!trimmed) return;
        await onAdd(trimmed);
        onSelect(trimmed);
        setNewName('');
        setIsCreating(false);
        setIsOpen(false);
    };

    return (
        <div className="relative inline-block" ref={ref}>
            <button
                type="button"
                onClick={() => {
                    if (readOnly) return;
                    setIsOpen(!isOpen); setIsCreating(false); setNewName(''); 
                }}
                className={`flex items-center gap-1.5 text-slate-400 text-[10px] font-bold ${readOnly ? 'cursor-default' : 'hover:text-white transition-colors group'}`}
            >
                <span className={`whitespace-nowrap ${value ? "text-blue-400" : "italic text-slate-600"}`}>
                    {value || "Select Category..."}
                </span>
                {!readOnly && <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : 'opacity-50'}`} />}
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[100] overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2">

                    {/* List Existing Categories */}
                    <div className="max-h-48 overflow-y-auto no-scrollbar">
                        {categories.map(c => (
                            <div
                                key={c.id}
                                className="flex items-center justify-between group/item px-4 py-2 hover:bg-blue-600 cursor-pointer transition-colors"
                                onClick={() => { onSelect(c.name); setIsOpen(false); }}
                            >
                                <span className={`text-[9px] sm:text-[10px] font-light tracking-wide ${value === c.name ? 'text-white' : 'text-slate-300'}`}>
                                    {c.name}
                                </span>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                                    className={`opacity-0 group-hover/item:opacity-100 text-slate-400 hover:text-white transition-all ml-2 ${c.created_by ? 'block' : 'hidden'}`}
                                    title="Delete category"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Separator only if there are existing categories */}
                    {categories.length > 0 && <div className="h-px bg-slate-800 my-1" />}

                    {/* Create New Logic */}
                    {isCreating ? (
                        <div className="px-3 py-2 flex items-center gap-2 bg-slate-800/50" onClick={(e) => e.stopPropagation()}>
                            <input
                                autoFocus
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAdd();
                                    if (e.key === 'Escape') { setIsCreating(false); setNewName(''); }
                                }}
                                placeholder="New Category..."
                                className="flex-1 min-w-0 bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-2 py-1.5 outline-none focus:border-blue-500"
                            />
                            <button
                                type="button"
                                onClick={handleAdd}
                                className="text-[10px] bg-blue-600 text-white font-black uppercase hover:bg-blue-500 px-2 py-1 rounded-lg transition-colors shadow-lg"
                            >
                                Add
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                if ((userRole === 'admin' || userRole === 'super_admin') && !isPrivateContext) {
                                    setIsOpen(false);
                                    window.dispatchEvent(new CustomEvent('openAdminSettings', { detail: 'Project Management' }));
                                } else {
                                    setIsCreating(true); 
                                }
                            }}
                            className="w-full px-4 py-2 text-left text-[10px] font-bold text-blue-400 hover:bg-blue-900/30 transition-colors flex items-center gap-2"
                        >
                            <Plus className="w-3 h-3" /> CREATE NEW
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

// --- Due By Dropdown Component ---
function DueByDropdown({ value, priority, onSelect, hideLabels, readOnly }) {
    const [isOpen, setIsOpen] = React.useState(false);
    const ref = React.useRef(null);

    React.useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // --- Helper Functions ---
    // Helper to get only the short priority code
    const getShortPriority = (p) => {
        if (!p) return null;
        if (p.includes('P1')) return 'P1';
        if (p.includes('P2')) return 'P2';
        if (p.includes('P3')) return 'P3';
        return null;
    };

    const getPriorityColor = (p) => {
        if (!p) return 'text-slate-400';
        if (p.includes('P1')) return 'text-red-500';
        if (p.includes('P2')) return 'text-orange-500';
        if (p.includes('P3')) return 'text-yellow-500';
        return 'text-slate-400';
    };

    const shortPriority = getShortPriority(priority);
    const priorityColor = getPriorityColor(priority);

    // Map specific due dates to their priority representation for the dropdown menu
    const getOptionPriority = (opt) => {
        if (['1 hr', '6 hrs', 'Today'].includes(opt)) return { text: 'P1', color: 'text-red-500' };
        if (['3 days', 'This Week'].includes(opt)) return { text: 'P2', color: 'text-orange-500' };
        if (['This Month'].includes(opt)) return { text: 'P3', color: 'text-yellow-500' };
        return null; // Backburner or unrecognized
    };

    return (
        <div className="relative inline-block" ref={ref}>
            <button
                type="button"
                onClick={() => !readOnly && setIsOpen(!isOpen)}
                className={`flex items-center gap-1.5 text-[10px] font-bold ${readOnly ? 'cursor-default' : 'hover:text-white transition-colors group'} whitespace-nowrap`}
            >
                <span className={`whitespace-nowrap ${value ? "text-blue-400" : "italic text-slate-600"}`}>
                    {value || "Due By..."}
                </span>
                {!hideLabels && shortPriority && (
                    <span className={`text-[10px] font-black ${priorityColor}`}>
                        {shortPriority}
                    </span>
                )}
                {!readOnly && <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : 'opacity-50'}`} />}
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-32 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[100] overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 cursor-pointer">
                    {DUE_BY_OPTIONS.map(opt => {
                        const optPriority = getOptionPriority(opt);
                        return (
                            <div
                                key={opt}
                                onClick={() => { onSelect(opt); setIsOpen(false); }}
                                className="flex items-center justify-between group/item px-4 py-2 hover:bg-blue-600 cursor-pointer transition-colors"
                            >
                                <span className={`text-[9px] sm:text-[10px] font-light tracking-wide ${value === opt ? 'text-white' : 'text-slate-300'}`}>
                                    {opt}
                                </span>
                                {!hideLabels && optPriority && (
                                    <span className={`text-[9px] font-bold tracking-wider ml-2 ${optPriority.color}`}>
                                        {optPriority.text}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// --- Internal Components ---
function StatCard({ label, shortLabel, value, icon: Icon, color, bgColor, onClick }) {
    return (
        <div
            onClick={onClick}
            className={`flex-1 min-w-0 glass p-2 sm:p-3 md:p-4 rounded-xl border border-transparent hover:border-slate-500/30 cursor-pointer transition-all group relative overflow-hidden flex flex-col justify-between stat-card-widget`}
            title={label}
        >
            <div className={`absolute -right-3 -bottom-3 sm:-right-4 sm:-bottom-4 opacity-10 md:opacity-20 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12 pointer-events-none`}>
                <Icon className={`w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 ${color}`} strokeWidth={1.5} />
            </div>

            <div className="flex justify-between items-start mb-1 md:mb-2 relative z-10 w-full">
                <span className={`hidden md:block text-[8px] sm:text-[9px] md:text-[10px] font-black uppercase tracking-[0.05em] md:tracking-[0.1em] truncate w-full pr-1 shrink leading-tight ${color}`}>{label}</span>
                <span className={`md:hidden block text-[8px] sm:text-[9px] md:text-[10px] font-black uppercase tracking-[0.05em] md:tracking-[0.1em] truncate w-full pr-1 shrink leading-tight ${color}`}>{shortLabel || label}</span>
            </div>

            <div className={`text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tighter relative z-10 truncate text-slate-200 mt-0.5 md:mt-1`}>
                {value}
            </div>
        </div>
    );
}

// --- Status Dropdown ---
function StatusDropdown({ task, updateTask, center, onPointerDownStop }) {
    const [isOpen, setIsOpen] = React.useState(false);
    const ref = React.useRef(null);

    React.useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const getColor = (s) => {
        if (s === 'Done') return 'text-emerald-400';
        if (s === 'In Progress') return 'text-blue-400';
        if (s === 'At Risk') return 'text-orange-400';
        if (s === 'Blocked') return 'text-red-400';
        return 'text-slate-400';
    };

    const handleSelect = (e, option) => {
        e.stopPropagation();
        setIsOpen(false);
        if (option === 'Done') {
            try { const audio = new Audio(doneSoundUrl); audio.play().catch(() => {}); } catch {}
            const rect = e.currentTarget.getBoundingClientRect();
            confetti({
                particleCount: 15, spread: 60, startVelocity: 15,
                colors: ['#10b981', '#34d399', '#059669', '#a7f3d0'],
                origin: { x: (rect.left + rect.width / 2) / window.innerWidth, y: (rect.top + rect.height / 2) / window.innerHeight },
                zIndex: 9999, disableForReducedMotion: true, ticks: 100, gravity: 0.8, scalar: 0.8
            });
            setTimeout(() => updateTask(task.id, 'status', 'Done'), 700);
        } else {
            updateTask(task.id, 'status', option);
        }
    };

    const current = task.status || 'To Do';
    return (
        <div className="relative inline-block" ref={ref}>
            <button
                type="button"
                onPointerDown={onPointerDownStop ? (e) => e.stopPropagation() : undefined}
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                className="flex items-center gap-1 text-[10px] font-bold hover:text-white transition-colors whitespace-nowrap"
            >
                <span className={getColor(current)}>{current}</span>
                <ChevronDown className={`w-3 h-3 transition-transform opacity-50 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className={`absolute top-full mt-1.5 w-32 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[200] overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 ${
                    center ? 'left-1/2 -translate-x-1/2' : 'left-0'
                }`}>
                    {STATUS_OPTIONS.map(opt => (
                        <div
                            key={opt.value}
                            onPointerDown={onPointerDownStop ? (e) => e.stopPropagation() : undefined}
                            onClick={(e) => handleSelect(e, opt.value)}
                            className={`px-4 py-2 text-[10px] font-bold cursor-pointer transition-colors hover:bg-blue-600 hover:text-white ${getColor(opt.value)} ${current === opt.value ? 'bg-slate-800/80' : ''}`}
                        >
                            {opt.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// --- Responsive Task Components ---
function TaskRow({ task, updateTask, categories, addCategory, deleteCategory, deleteTask, showAssignee, userRole }) {
    const textareaRef = React.useRef(null);
    const notesTextareaRef = React.useRef(null);
    const [isNotesOpen, setIsNotesOpen] = React.useState(false);
    const [draftNotes, setDraftNotes] = React.useState(task.notes || '');

    React.useEffect(() => {
        if (task.action === '' && textareaRef.current && !isNotesOpen) {
            textareaRef.current.focus();
        }
    }, [task.action, isNotesOpen]);

    if (isNotesOpen && ['admin', 'super_admin'].includes(userRole)) {
        return (
            <tr className="bg-slate-800/60 border-y border-blue-500/20">
                <td colSpan={100} className="px-3 py-2">
                    <div className="flex items-center gap-2 w-full">
                        <input
                            ref={notesTextareaRef}
                            type="text"
                            value={draftNotes}
                            onChange={(e) => setDraftNotes(e.target.value.slice(0, 500))}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    updateTask(task.id, { notes: draftNotes.trim() !== '' ? draftNotes.trim() : null });
                                    setIsNotesOpen(false);
                                }
                                if (e.key === 'Escape') {
                                    setIsNotesOpen(false);
                                    setDraftNotes(task.notes || '');
                                }
                            }}
                            maxLength={500}
                            className="flex-1 bg-transparent border-none outline-none text-slate-300 text-[10px] md:text-xs placeholder:text-slate-600 min-w-0"
                            placeholder="Task notes..."
                        />
                        <span className={`text-[9px] font-bold shrink-0 ${draftNotes.length >= 500 ? 'text-red-500' : 'text-slate-600'}`}>
                            {draftNotes.length}/500
                        </span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                updateTask(task.id, { notes: draftNotes.trim() !== '' ? draftNotes.trim() : null });
                                setIsNotesOpen(false);
                            }}
                            className="shrink-0 text-[9px] font-black uppercase tracking-wider px-3 py-1 bg-slate-700 hover:bg-blue-600 text-slate-300 hover:text-white rounded-lg transition-colors active:scale-95"
                        >
                            Save
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsNotesOpen(false); setDraftNotes(task.notes || ''); }}
                            className="shrink-0 text-slate-500 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-700 transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </td>
            </tr>
        );
    }


    return (
        <tr className={`hover:bg-blue-600/[0.03] transition-colors group ${isTaskOverdue(task.target_deadline) && task.status !== 'Done' && task.priority && task.priority.includes('P1') ? 'bg-red-900/10' : ''} ${task.assigned_by_role === 'worker' ? 'bg-slate-800 shadow-[inset_0_0_20px_rgba(0,0,0,0.3)]' : ''}`}>
            <td className="px-4 py-3">
                <StatusDropdown task={task} updateTask={updateTask} center={true} />
            </td>
            <td className="px-4 py-3 min-w-[250px] w-full max-w-sm relative">
                {/* BIG BACKGROUND OVERDUE TEXT */}
                {isTaskOverdue(task.target_deadline) && task.status !== 'Done' && task.priority && task.priority.includes('P1') && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0">
                        <span className="text-red-500/10 font-black text-5xl md:text-6xl tracking-[0.2em] uppercase -rotate-6 select-none whitespace-nowrap">
                            OVERDUE!
                        </span>
                    </div>
                )}

                <textarea
                    ref={textareaRef}
                    value={task.action}
                    onChange={(e) => updateTask(task.id, 'action', e.target.value)}
                    className={`bg-transparent border-none outline-none w-full font-bold text-sm md:text-base focus:text-blue-400 transition-colors placeholder:text-slate-800 resize-none overflow-hidden block relative z-10 ${task.status === 'Done' ? 'text-slate-500' : 'text-slate-200'}`}
                    placeholder="Task description..."
                    rows={1}
                    onInput={(e) => {
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                />
            </td>
            {showAssignee && (
                <td className="px-4 py-3 text-[10px] font-black uppercase text-blue-400 tracking-wider">
                    {task.assigned_by_role === 'worker' ? 'Personal Task' : task.assignee}
                </td>
            )}
            <td className="px-4 py-3 whitespace-nowrap">
                <CategoryDropdown
                    userRole={userRole}
                    categories={categories}
                    value={task.category || ''}
                    onSelect={(name) => updateTask(task.id, 'category', name)}
                    onAdd={(name) => addCategory(name, null, task.assigned_by_role === 'worker')}
                    onDelete={deleteCategory}
                    isPrivateContext={task.assigned_by_role === 'worker'}
                />
            </td>
            <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                    <DueByDropdown
                        value={task.due_by_type || ''}
                        priority={task.priority}
                        onSelect={(val) => updateTask(task.id, 'due_by_type', val)}
                    />
                </div>
            </td>
            {['admin', 'super_admin'].includes(userRole) && (
                <>
                    <td className="px-4 py-3 text-center">
                        <button 
                            onClick={(e) => { e.stopPropagation(); updateTask(task.id, { is_notified: !task.is_notified }); }}
                            className="flex justify-center w-full transition-transform hover:scale-110"
                            title={task.is_notified ? 'Remove notification' : 'Mark as notified'}
                        >
                            <Bell className={`w-4 h-4 transition-colors ${task.is_notified ? 'text-red-500 fill-current' : 'text-slate-600 hover:text-slate-400'}`} />
                        </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                        <button
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                setIsNotesOpen(true); 
                                setTimeout(() => notesTextareaRef.current?.focus(), 50);
                            }}
                            className={`text-[10px] font-black uppercase tracking-wider transition-colors pt-0.5 ${task.notes && task.notes.trim() !== '' ? 'text-emerald-500' : 'text-slate-500 hover:text-slate-400'}`}
                        >
                            Notes
                        </button>
                    </td>
                </>
            )}
            <td className="px-4 py-3 text-center">
                <button
                    onClick={() => deleteTask(task.id)}
                    className="text-slate-800 hover:text-red-500 transition-all transform hover:scale-125 p-2"
                    title="Delete (Move to Trash)"
                >
                    <Trash2 className="w-5 h-5" />
                </button>
            </td>
        </tr>
    );
}

function TaskCard({ task, updateTask, categories, addCategory, deleteCategory, deleteTask, showAssignee, hideLabels, userRole }) {
    const [isNotesOpen, setIsNotesOpen] = React.useState(false);
    const [draftNotes, setDraftNotes] = React.useState(task.notes || '');
    const notesTextareaRef = React.useRef(null);
    const textareaRef = React.useRef(null);

    React.useEffect(() => {
        setDraftNotes(task.notes || '');
    }, [task.notes]);

    React.useEffect(() => {
        if (task.action === '' && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [task.action]);

    const isWorker = userRole === 'worker';

    const getStatusBorderClass = (status) => {
        if (status === 'In Progress') return 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]';
        if (status === 'At Risk')     return 'border-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.3)]';
        if (status === 'Blocked')     return 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]';
        return 'border-slate-700/50';
    };

    const statusBorder = getStatusBorderClass(task.status);

    return (
        <div className={`p-2 md:p-2.5 rounded-xl border flex flex-col gap-1.5 relative transition-colors ${task.assigned_by_role === 'worker' ? 'bg-slate-800 shadow-[inset_0_0_20px_rgba(0,0,0,0.2)] border-slate-600' : 'bg-slate-800/40'} ${isTaskOverdue(task.target_deadline) && task.status !== 'Done' && task.priority && task.priority.includes('P1') ? 'border-red-900/50 bg-red-900/10' : statusBorder}`}>

            {/* BIG BACKGROUND OVERDUE TEXT */}
            {isTaskOverdue(task.target_deadline) && task.status !== 'Done' && task.priority && task.priority.includes('P1') && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-0 overflow-hidden rounded-xl">
                    <span className="text-red-500/10 font-black text-5xl tracking-[0.2em] uppercase -rotate-12 select-none whitespace-nowrap">
                        OVERDUE!
                    </span>
                </div>
            )}

            {/* Top row: Assignee / Bell / Notes / Trash */}
            <div className="flex items-center w-full mb-0.5 relative z-10">
                {/* LEFT: Assignee */}
                <div className="flex-1 flex justify-start min-w-0">
                    {showAssignee && (
                        <div className="text-[8px] font-black uppercase text-blue-400 tracking-wider truncate max-w-[100px]">
                            {task.assigned_by_role === 'worker' ? 'Personal Task' : task.assignee}
                        </div>
                    )}
                </div>

                {/* CENTER: Notified Bell */}
                <div className="flex-1 flex justify-center shrink-0">
                    <button 
                        onClick={(e) => { e.stopPropagation(); updateTask(task.id, { is_notified: !task.is_notified }); }}
                        className="transition-transform hover:scale-110"
                        title={task.is_notified ? 'Remove notification' : 'Mark as notified'}
                    >
                        <Bell className={`w-3.5 h-3.5 transition-colors ${task.is_notified ? 'text-red-500 fill-current' : 'text-slate-500 hover:text-slate-400'}`} />
                    </button>
                </div>

                {/* RIGHT: Notes & Trash */}
                <div className="flex-1 flex justify-end items-center gap-2 shrink-0">
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsNotesOpen(true); setTimeout(() => notesTextareaRef.current?.focus(), 50); }}
                        className={`text-[8px] font-black uppercase tracking-wider transition-colors ${task.notes && task.notes.trim() !== '' ? 'text-emerald-500' : 'text-slate-500 hover:text-slate-400'}`}
                    >
                        Notes
                    </button>
                    <button onClick={() => deleteTask(task.id)} className="text-slate-500 hover:text-red-500 transition-colors p-1 shrink-0">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <textarea
                ref={textareaRef}
                value={task.action}
                onChange={(e) => updateTask(task.id, 'action', e.target.value)}
                className={`bg-transparent border-none outline-none w-full font-bold text-sm md:text-base focus:text-blue-400 transition-colors placeholder:text-slate-600 resize-none overflow-hidden block relative z-10 pt-0.5 ${task.status === 'Done' ? 'text-slate-500' : 'text-slate-200'}`}
                placeholder="Task description..."
                rows={1}
                onInput={(e) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                }}
            />

            {/* Bottom row: Category / Status / Due By or Done pill */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-700/50">
                <CategoryDropdown
                    userRole={userRole}
                    categories={categories}
                    value={task.category || ''}
                    onSelect={(name) => updateTask(task.id, 'category', name)}
                    onAdd={(name) => addCategory(name, null, task.assigned_by_role === 'worker')}
                    onDelete={deleteCategory}
                    isPrivateContext={task.assigned_by_role === 'worker'}
                />

                {task.status === 'Done' ? (
                    <button
                        onClick={(e) => { e.stopPropagation(); updateTask(task.id, 'status', 'In Progress'); }}
                        className="text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
                    >
                        DONE
                    </button>
                ) : (
                    <StatusDropdown task={task} updateTask={updateTask} />
                )}

                {task.status !== 'Done' && (
                    <DueByDropdown
                        value={task.due_by_type || ''}
                        priority={task.priority}
                        onSelect={(val) => updateTask(task.id, 'due_by_type', val)}
                        hideLabels={hideLabels}
                    />
                )}
            </div>

            {/* Expanded Inline Notes Overlay for TaskCard */}
            {isNotesOpen && (
                <div className="absolute top-0 left-0 w-full min-h-[180px] bg-slate-900/98 backdrop-blur-md z-[120] flex flex-col p-3 md:p-4 animate-in fade-in duration-200 rounded-2xl border border-slate-600 shadow-[0_20px_60px_-15px_rgba(0,0,0,1)]" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center px-1 mb-2">
                        <div className="flex items-center gap-2">
                            <h3 className="text-emerald-500 text-[10px] md:text-xs font-black tracking-widest uppercase">Notes</h3>
                            {!isWorker && (
                                <span className={`text-[8px] font-bold ${draftNotes.length >= 500 ? 'text-red-500' : 'text-slate-500'}`}>{draftNotes.length}/500</span>
                            )}
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setIsNotesOpen(false); setDraftNotes(task.notes || ''); }} className="text-slate-500 hover:text-slate-300 p-1 bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    
                    {isWorker ? (
                        <div className="flex-1 w-full min-h-[130px] bg-slate-800/50 rounded-xl p-3 border border-slate-700/50 text-slate-300 text-xs md:text-sm overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words leading-relaxed shadow-inner">
                            {task.notes || <span className="text-slate-500 italic">No notes provided.</span>}
                        </div>
                    ) : (
                        <div className="flex-1 w-full min-h-[130px] bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden flex flex-col relative focus-within:border-blue-500/50 transition-colors shadow-inner">
                            <textarea 
                                ref={notesTextareaRef}
                                value={draftNotes}
                                onChange={(e) => setDraftNotes(e.target.value)}
                                maxLength={500}
                                className="flex-1 w-full h-[140px] px-3 pt-3 pb-1 bg-transparent text-slate-300 text-xs md:text-sm resize-none outline-none leading-relaxed"
                                placeholder="Task notes... (max 500 characters)"
                            />
                            <div className="bg-slate-900/40 p-2 flex justify-end shrink-0 border-t border-slate-700/30">
                                <button 
                                    onClick={(e) => { 
                                        e.stopPropagation(); 
                                        updateTask(task.id, { notes: draftNotes.trim() !== '' ? draftNotes.trim() : null });
                                        setIsNotesOpen(false);
                                    }} 
                                    className="text-slate-300 hover:text-emerald-400 text-[10px] md:text-[11px] font-bold uppercase tracking-wider transition-colors px-4 py-1 bg-slate-800 border border-slate-600 hover:border-emerald-500/50 rounded-lg shadow-md hover:shadow-emerald-500/10 active:scale-95 z-10"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// --- Kanban Helpers ---
function DraggableTaskCard({ task, updateTask, categories, addCategory, deleteCategory, hideLabels, userRole, isDraggable = true }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: task.id,
        data: { task },
        disabled: !isDraggable
    });
    
    const [isNotesOpen, setIsNotesOpen] = React.useState(false);
    const [draftNotes, setDraftNotes] = React.useState(task.notes || '');
    const notesTextareaRef = React.useRef(null);
    
    React.useEffect(() => {
        setDraftNotes(task.notes || '');
    }, [task.notes]);

    const style = {
        opacity: isDragging ? 0 : 1, // Completely hide original so only overlay is visible
    };

    const isWorker = userRole === 'worker';

    const getStatusBorderClass = (status) => {
        if (status === 'In Progress') return 'border-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.3)]';
        if (status === 'At Risk')     return 'border-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.3)]';
        if (status === 'Blocked')     return 'border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]';
        return 'border-slate-700/50 hover:border-slate-500/50';
    };

    const statusBorder = getStatusBorderClass(task.status);

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="w-full relative touch-none"
            {...attributes}
            {...listeners}
        >
            <div className={`p-1.5 rounded-xl border transition-colors group flex flex-col gap-1 relative ${task.assigned_by_role === 'worker' ? 'bg-slate-800 shadow-[inset_0_0_20px_rgba(0,0,0,0.2)] border-slate-600' : 'bg-slate-800/60'} ${isTaskOverdue(task.target_deadline) && task.status !== 'Done' && task.priority && task.priority.includes('P1') ? 'border-red-900/50 bg-red-900/10' : statusBorder}`}>

                {/* BIG BACKGROUND OVERDUE TEXT */}
                {isTaskOverdue(task.target_deadline) && task.status !== 'Done' && task.priority && task.priority.includes('P1') && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-0 overflow-hidden rounded-xl">
                        <span className="text-red-500/10 font-black text-4xl md:text-5xl tracking-widest uppercase -rotate-12 select-none whitespace-nowrap">
                            OVERDUE!
                        </span>
                    </div>
                )}

                <div className="flex items-start relative z-10">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center w-full mb-0.5 pr-1">
                            {/* LEFT: Assignee */}
                            <div className="flex-1 flex justify-start min-w-0">
                                <div className="text-[8px] font-black uppercase text-blue-400 tracking-wider truncate max-w-[100px]">
                                    {task.assigned_by_role === 'worker' ? 'Personal Task' : task.assignee}
                                </div>
                            </div>
                            
                            {/* CENTER: Notified Bell */}
                            <div className="flex-1 flex justify-center shrink-0">
                                <button 
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => { e.stopPropagation(); updateTask(task.id, { is_notified: !task.is_notified }); }}
                                    className="transition-transform hover:scale-110"
                                    title={task.is_notified ? 'Remove notification' : 'Mark as notified'}
                                >
                                    <Bell className={`w-3.5 h-3.5 transition-colors ${task.is_notified ? 'text-red-500 fill-current' : 'text-slate-500 hover:text-slate-400'}`} />
                                </button>
                            </div>

                            {/* RIGHT: Notes */}
                            <div className="flex-1 flex justify-end items-center shrink-0">
                                <button 
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => { e.stopPropagation(); setIsNotesOpen(true); setTimeout(() => notesTextareaRef.current?.focus(), 50); }}
                                    className={`text-[8px] font-black uppercase tracking-wider transition-colors ${task.notes && task.notes.trim() !== '' ? 'text-emerald-500' : 'text-slate-500 hover:text-slate-400'}`}
                                >
                                    Notes
                                </button>
                            </div>
                        </div>
                        <textarea
                            onPointerDown={(e) => e.stopPropagation()}
                            value={task.action}
                            onChange={(e) => updateTask(task.id, 'action', e.target.value)}
                            readOnly={isWorker}
                            className={`w-full bg-transparent border-none outline-none font-bold text-sm resize-none overflow-hidden block ${task.status === 'Done' ? 'text-slate-500' : 'text-slate-200 focus:text-blue-400'} ${isWorker ? 'focus:text-slate-200 cursor-default' : ''}`}
                            placeholder="Task description..."
                            rows={1}
                            onInput={(e) => {
                                e.target.style.height = 'auto';
                                e.target.style.height = e.target.scrollHeight + 'px';
                            }}
                        />
                    </div>
                </div>
                <div
                    className="flex justify-between items-center pt-1 border-t border-slate-700/30 gap-2"
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <CategoryDropdown
                        userRole={userRole}
                        categories={categories}
                        value={task.category || ''}
                        onSelect={(name) => updateTask(task.id, 'category', name)}
                        onAdd={(name) => addCategory(name, null, task.assigned_by_role === 'worker')}
                        onDelete={deleteCategory}
                        readOnly={isWorker}
                        isPrivateContext={task.assigned_by_role === 'worker'}
                    />

                    {task.status === 'Done' ? (
                        <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); updateTask(task.id, 'status', 'In Progress'); }}
                            className="text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
                        >
                            DONE
                        </button>
                    ) : (
                        <StatusDropdown task={task} updateTask={updateTask} onPointerDownStop={true} />
                    )}

                    {task.status !== 'Done' && (
                        <DueByDropdown
                            value={task.due_by_type || ''}
                            priority={task.priority}
                            onSelect={(val) => updateTask(task.id, 'due_by_type', val)}
                            hideLabels={hideLabels}
                            readOnly={isWorker}
                        />
                    )}
                </div>

                {/* Expanded Inline Notes Overlay for DraggableTaskCard */}
                {isNotesOpen && (
                    <div className="absolute top-0 left-0 w-full md:w-[105%] md:-left-[2.5%] min-h-[170px] bg-slate-900/98 backdrop-blur-md z-[120] flex flex-col p-2.5 md:p-3 animate-in fade-in duration-200 rounded-2xl border border-slate-600 shadow-[0_20px_60px_-15px_rgba(0,0,0,1)]" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center px-1 mb-2">
                            <div className="flex items-center gap-2">
                                <h3 className="text-emerald-500 text-[10px] md:text-xs font-black tracking-widest uppercase">Notes</h3>
                                {!isWorker && (
                                    <span className={`text-[8px] font-bold ${draftNotes.length >= 500 ? 'text-red-500' : 'text-slate-500'}`}>{draftNotes.length}/500</span>
                                )}
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); setIsNotesOpen(false); setDraftNotes(task.notes || ''); }} className="text-slate-500 hover:text-slate-300 p-1 bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        
                        {isWorker ? (
                            <div className="w-full min-h-[120px] bg-slate-800/50 rounded-xl border border-slate-700/50 p-2.5 text-slate-300 text-[10px] md:text-xs overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words leading-relaxed shadow-inner">
                                {task.notes || <span className="text-slate-500 italic">No notes provided.</span>}
                            </div>
                        ) : (
                            <div className="w-full bg-slate-800/50 rounded-xl border border-slate-700/50 flex flex-col focus-within:border-blue-500/50 transition-colors shadow-inner overflow-hidden shrink-0">
                                <textarea 
                                    ref={notesTextareaRef}
                                    value={draftNotes}
                                    onChange={(e) => setDraftNotes(e.target.value)}
                                    maxLength={500}
                                    className="w-full h-[140px] px-2.5 pt-2.5 pb-1 bg-transparent text-slate-300 text-[10px] md:text-xs resize-none outline-none leading-relaxed"
                                    placeholder="Task notes... (max 500 character limit)"
                                />
                                <div className="bg-slate-900/40 p-1.5 flex justify-end shrink-0 border-t border-slate-700/30">
                                    <button 
                                        onClick={(e) => { 
                                            e.stopPropagation(); 
                                            updateTask(task.id, { notes: draftNotes.trim() !== '' ? draftNotes.trim() : null });
                                            setIsNotesOpen(false);
                                        }} 
                                        className="text-slate-300 hover:text-emerald-400 text-[9px] md:text-[10px] font-bold uppercase tracking-wider transition-colors px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-emerald-500/50 rounded-lg shadow-md hover:shadow-emerald-500/10 active:scale-95 z-10"
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function DroppableColumn({ id, title, colorClass, bgClass, borderClass, activeBorderClass, orderClass, tasks, children }) {
    const { isOver, setNodeRef } = useDroppable({ id });
    const currentBorder = isOver ? activeBorderClass : borderClass;

    const scrollRef = React.useRef(null);
    const [showScrollHint, setShowScrollHint] = React.useState(false);

    React.useEffect(() => {
        const checkScroll = () => {
            if (scrollRef.current) {
                const { scrollHeight, clientHeight, scrollTop } = scrollRef.current;
                const isBottom = scrollHeight - scrollTop - clientHeight < 15;
                setShowScrollHint(scrollHeight > clientHeight && !isBottom);
            }
        };

        const timer = setTimeout(checkScroll, 100);
        window.addEventListener('resize', checkScroll);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', checkScroll);
        };
    }, [tasks]);

    const handleScroll = () => {
        if (scrollRef.current) {
            const { scrollHeight, clientHeight, scrollTop } = scrollRef.current;
            const isBottom = scrollHeight - scrollTop - clientHeight < 15;
            setShowScrollHint(scrollHeight > clientHeight && !isBottom);
        }
    };

    return (
        <div ref={setNodeRef} className={`flex flex-col h-auto min-h-[150px] max-h-[60vh] md:h-[70vh] md:min-h-[400px] md:max-h-[800px] bg-slate-900/40 rounded-2xl border ${currentBorder} transition-all duration-300 relative overflow-hidden group ${orderClass || ''}`}>
            {/* Column Header */}
            <div className={`${bgClass} p-3 border-b ${currentBorder} flex justify-between items-center transition-all duration-300 rounded-t-2xl z-10 shrink-0`}>
                <h3 className={`text-xs font-black uppercase tracking-wider ${colorClass}`}>{title}</h3>
                <span className={`text-[10px] font-bold ${colorClass} opacity-70`}>{tasks.length}</span>
            </div>
            {/* Task List */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 p-2 flex flex-col gap-2 pb-12 md:pb-24 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-slate-800/30 [&::-webkit-scrollbar-thumb]:bg-slate-700/80 hover:[&::-webkit-scrollbar-thumb]:bg-slate-500 [&::-webkit-scrollbar-thumb]:rounded-full"
            >
                {children}
            </div>

            {/* Scroll Hint */}
            <div className={`absolute bottom-0 left-0 right-0 py-2.5 px-4 ${bgClass} border-t ${borderClass} flex justify-center items-center backdrop-blur-md z-20 pointer-events-none transition-all duration-500 ease-in-out ${showScrollHint ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
                {/* Gradient fade above the hint */}
                <div className="absolute bottom-full left-0 right-0 h-10 bg-gradient-to-t from-slate-900/90 to-transparent pointer-events-none" />

                <span className={`text-[10px] font-black uppercase tracking-widest ${colorClass} flex items-center gap-2`}>
                    <ChevronDown className="w-3.5 h-3.5 animate-bounce" /> Scroll for more tasks
                </span>
            </div>
        </div>
    );
}

// --- All Tasks Rolldown Board Component ---
function AllTasksBoard({ tasks, userRole, categoryFilter, updateTask, categories, addCategory, deleteCategory, deleteTask, kanbanEnabled }) {
    const [activeId, setActiveId] = React.useState(null);
    const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5, // 5px movement to start drag
            },
        })
    );

    // Helper to filter tasks by priority/status and currently selected category
    const getTasksByBucket = (bucketName) => {
        let bucketTasks = [];
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        switch (bucketName) {
            case 'P1':
                bucketTasks = tasks.filter(t => t.priority && t.priority.includes('P1') && t.status !== 'Done' && t.status !== 'Deleted' && !t.is_archived);
                break;
            case 'P2':
                bucketTasks = tasks.filter(t => t.priority && t.priority.includes('P2') && t.status !== 'Done' && t.status !== 'Deleted' && !t.is_archived);
                break;
            case 'P3':
                bucketTasks = tasks.filter(t => t.priority && t.priority.includes('P3') && t.status !== 'Done' && t.status !== 'Deleted' && !t.is_archived);
                break;
            case 'Backburner':
                bucketTasks = tasks.filter(t => t.priority === 'Backburner' && t.status !== 'Done' && t.status !== 'Deleted' && !t.is_archived);
                break;
            case 'Completed':
                bucketTasks = tasks.filter(t => {
                    if (t.status !== 'Done') return false;
                    const compDate = t.deletion_date || t.submitted_on || t.created_at || t.date;
                    return new Date(compDate) >= sevenDaysAgo;
                });
                break;
            default:
                break;
        }

        // Apply category filter if not 'All'
        if (categoryFilter !== 'All') {
            bucketTasks = bucketTasks.filter(t => t.category === categoryFilter);
        }

        return bucketTasks;
    };

    const columns = [
        { id: 'P1', title: 'P1 (HIGH)', colorClass: 'text-red-500', bgClass: 'bg-red-500/10', borderClass: 'border-red-500/20', activeBorderClass: 'border-red-400 ring-2 ring-red-500 shadow-[inset_0_0_20px_rgba(239,68,68,0.2)]', newPriority: 'P1', newDueBy: 'Today', orderClass: 'order-1 md:order-4' },
        { id: 'P2', title: 'P2 (NORMAL)', colorClass: 'text-orange-500', bgClass: 'bg-orange-500/10', borderClass: 'border-orange-500/20', activeBorderClass: 'border-orange-400 ring-2 ring-orange-500 shadow-[inset_0_0_20px_rgba(249,115,22,0.2)]', newPriority: 'P2', newDueBy: 'This Week', orderClass: 'order-2 md:order-3' },
        { id: 'P3', title: 'P3 (LOW)', colorClass: 'text-yellow-500', bgClass: 'bg-yellow-500/10', borderClass: 'border-yellow-500/20', activeBorderClass: 'border-yellow-400 ring-2 ring-yellow-500 shadow-[inset_0_0_20px_rgba(234,179,8,0.2)]', newPriority: 'P3', newDueBy: 'This Month', orderClass: 'order-3 md:order-2' },
        { id: 'Backburner', title: 'Backburner', colorClass: 'text-slate-400', bgClass: 'bg-slate-500/10', borderClass: 'border-slate-500/20', activeBorderClass: 'border-slate-300 ring-2 ring-slate-400 shadow-[inset_0_0_20px_rgba(148,163,184,0.2)]', newPriority: 'Backburner', newDueBy: 'Backburner', orderClass: 'order-4 md:order-1' },
        { id: 'Completed', title: 'Done (7 Days)', colorClass: 'text-emerald-500', bgClass: 'bg-emerald-500/10', borderClass: 'border-emerald-500/20', activeBorderClass: 'border-emerald-400 ring-2 ring-emerald-500 shadow-[inset_0_0_20px_rgba(16,185,129,0.2)]', isDone: true, orderClass: 'order-5 md:order-5' },
    ];

    function handleDragStart(event) {
        setActiveId(event.active.id);
    }

    function handleDragEnd(event) {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const taskId = active.id;
        const destColId = over.id;

        const destCol = columns.find(c => c.id === destColId);

        // If dropping into a valid column
        if (destCol) {
            if (destCol.isDone) {
                updateTask(taskId, 'status', 'Done');
            } else {
                updateTask(taskId, {
                    priority: destCol.newPriority,
                    due_by_type: destCol.newDueBy,
                    status: 'In Progress'
                });
            }
        }
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="grid grid-cols-1 md:grid-flow-col md:auto-cols-fr gap-2 md:gap-4 w-full">
                {columns.map(col => {
                    const colTasks = getTasksByBucket(col.id);
                    // Only hide 'Backburner' column if empty and not dragging
                    const isDragging = activeTask !== null;
                    if (colTasks.length === 0 && col.id === 'Backburner' && !isDragging) {
                        return null;
                    }
                    return (
                        <DroppableColumn key={col.id} id={col.id} {...col} tasks={colTasks}>
                            {colTasks.length === 0 ? (
                                <div className="text-center py-8 text-slate-600 italic text-xs">Clear</div>
                            ) : (
                                colTasks.map(task => (
                                    <DraggableTaskCard userRole={userRole}
                                        key={task.id}
                                        task={task}
                                        updateTask={updateTask}
                                        categories={categories}
                                        addCategory={addCategory}
                                        deleteCategory={deleteCategory}
                                        hideLabels={true}
                                        isDraggable={kanbanEnabled}
                                    />
                                ))
                            )}
                        </DroppableColumn>
                    );
                })}
            </div>

            <DragOverlay modifiers={[snapCenterToCursor]}>
                {activeTask ? (
                    <div className="rotate-2 scale-[1.05] shadow-[0_20px_40px_-15px_rgba(59,130,246,0.6)] ring-2 ring-blue-500 rounded-xl opacity-90 pointer-events-none w-[280px]">
                        <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700/50 flex flex-col gap-2">
                            <div className="flex items-start gap-3">
                                <button className={`shrink-0 w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center transition-colors ${activeTask.status === 'Done' ? 'bg-emerald-500 border-emerald-500' : 'border-slate-500'}`}>
                                    {activeTask.status === 'Done' && <CheckCircle2 className="w-3 h-3 text-slate-900" />}
                                </button>
                                <div className="flex-1 min-w-0">
                                    <div className="text-[10px] font-black uppercase text-blue-400 tracking-wider mb-1 truncate">
                                        {activeTask.assignee}
                                    </div>
                                    <div className={`w-full bg-transparent border-none outline-none font-bold text-sm block min-h-6 break-words ${activeTask.status === 'Done' ? 'text-slate-500' : 'text-slate-200'}`}>
                                        {activeTask.action || "Task description..."}
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-start pt-1 border-t border-slate-700/30">
                                <span className="bg-slate-800/80 border border-slate-700 text-slate-300 text-[10px] font-bold rounded-lg px-2 py-1">
                                    {activeTask.category || "Select Category..."}
                                </span>
                            </div>
                        </div>
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}

// --- Global Add Task Modal Component ---
function GlobalAddTaskModal({ isOpen, isPersonalMode, onClose, userRole, currentUserRosterName, teamMembers, profiles, categories, addTask, updateTask, addCategory, deleteCategory }) {
    const [action, setAction] = React.useState('');
    const [assignee, setAssignee] = React.useState('');
    const [category, setCategory] = React.useState('');
    const [dueByType, setDueByType] = React.useState('This Week');
    const [isNotified, setIsNotified] = React.useState(false);
    const [notes, setNotes] = React.useState('');
    const [isNotesOpen, setIsNotesOpen] = React.useState(false);
    const textareaRef = React.useRef(null);
    const notesTextareaRef = React.useRef(null);

    React.useEffect(() => {
        if (isOpen) {
            setAction('');
            setAssignee('');
            setCategory(categories.length > 0 ? categories[0].name : '');
            setDueByType('This Week');
            setIsNotified(false);
            setNotes('');
            setIsNotesOpen(false);
            setTimeout(() => {
                if (textareaRef.current) textareaRef.current.focus();
            }, 50);
        }
    }, [isOpen, teamMembers, categories]);

    const handleCreate = async () => {
        let finalAssignee = assignee;
        if (userRole === 'worker' || isPersonalMode) {
            finalAssignee = currentUserRosterName;
        }
        if (!action.trim() || !finalAssignee) return;
        const submitRole = isPersonalMode ? 'worker' : userRole;
        const newTask = await addTask(finalAssignee, submitRole);
        if (newTask) {
            updateTask(newTask.id, {
                action: action.trim(),
                category,
                due_by_type: dueByType,
                is_notified: isNotified,
                notes: notes.trim() !== '' ? notes.trim() : null
            });
        }
        onClose();
    };

    if (!isOpen) return null;

    const mockPriority = ['1 hr', '6 hrs', 'Today'].includes(dueByType) ? 'P1' : ['3 days', 'This Week'].includes(dueByType) ? 'P2' : ['This Month'].includes(dueByType) ? 'P3' : null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={onClose}>

            <div className="w-full max-w-lg bg-slate-800/90 p-5 md:p-6 rounded-[2rem] border border-slate-700/50 flex flex-col gap-6 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] relative" onClick={e => e.stopPropagation()}>

                <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-red-400 transition-colors p-1">
                    <X className="w-5 h-5" />
                </button>

                <div className="flex justify-between items-start gap-2 pr-8">
                    {userRole === 'worker' || isPersonalMode ? (
                        <div className="flex flex-col">
                            <h2 className="text-lg md:text-xl font-black text-white tracking-widest uppercase italic">Personal Task</h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 italic">Private to your board</p>
                        </div>
                    ) : (
                        <div className="relative group">
                            <select
                                value={assignee}
                                onChange={(e) => setAssignee(e.target.value)}
                                className="appearance-none bg-blue-500/20 text-[10px] md:text-xs font-black uppercase px-3 py-1.5 rounded-md border border-blue-500/30 text-blue-300 outline-none cursor-pointer transition-all hover:bg-blue-500/30 pr-8"
                            >
                                <option value="" disabled>Assigned To</option>
                                {teamMembers
                                    .filter(m => {
                                        if (userRole === 'super_admin') return true;
                                        if (m.name === currentUserRosterName) return true;
                                        // Cross-reference with profiles by user_id first, then email fallback
                                        const memberProfile = m.user_id
                                            ? profiles.find(p => p.id === m.user_id)
                                            : m.email
                                                ? profiles.find(p => p.email?.toLowerCase().trim() === m.email.toLowerCase().trim())
                                                : null;
                                        const memberRole = memberProfile?.role;
                                        // Admins can only assign to workers (not other admins/super_admins)
                                        if (memberRole === 'admin' || memberRole === 'super_admin') return false;
                                        return true;
                                    })
                                    .map(m => <option key={m.id} value={m.name} className="bg-slate-900">{m.name}</option>)
                                }
                            </select>
                            <ChevronDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none group-hover:text-blue-300 transition-colors" />
                        </div>
                    )}
                </div>

                <textarea
                    ref={textareaRef}
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    className="bg-transparent border-none outline-none w-full font-bold text-lg md:text-xl text-white focus:text-blue-400 transition-colors placeholder:text-slate-600 resize-none overflow-hidden block"
                    placeholder="Task description..."
                    rows={1}
                    onInput={(e) => {
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleCreate();
                        }
                    }}
                />

                <div className="flex flex-wrap items-start justify-between gap-3 pt-4 border-t border-slate-700/50">
                    <div className="flex flex-col gap-2 relative">
                        <CategoryDropdown
                            userRole={userRole}
                            categories={categories}
                            value={category}
                            onSelect={setCategory}
                            onAdd={(name) => addCategory(name, null, isPersonalMode)}
                            onDelete={deleteCategory}
                            isPrivateContext={isPersonalMode}
                        />

                        {/* Add Task Modal Notifications Toggle */}
                        {['admin', 'super_admin'].includes(userRole) && (
                            <div className="flex flex-col gap-0.5 items-start mt-2 pl-1">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setIsNotified(!isNotified); }}
                                    className="transition-transform hover:scale-110"
                                    title={isNotified ? 'Remove notification' : 'Mark as notified'}
                                >
                                    <Bell className={`w-4 h-4 transition-colors ${isNotified ? 'text-red-500 fill-current' : 'text-slate-500 hover:text-slate-400'}`} />
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setIsNotesOpen(true); setTimeout(() => notesTextareaRef.current?.focus(), 50); }}
                                    className={`text-[9px] font-black uppercase tracking-wider transition-colors ${notes.trim() !== '' ? 'text-emerald-500' : 'text-slate-500 hover:text-slate-400'}`}
                                >
                                    Notes
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col items-end gap-3 shrink-0 min-h-[70px] justify-between">
                        <div className="flex items-center gap-2">
                            <DueByDropdown
                                value={dueByType}
                                priority={mockPriority}
                                onSelect={setDueByType}
                            />
                        </div>
                        <button
                            onClick={handleCreate}
                            disabled={!action.trim() || (userRole !== 'worker' && !isPersonalMode && !assignee)}
                            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-xl transition-all active:scale-95 shadow-lg flex items-center justify-center min-w-[120px] text-sm"
                        >
                            Add Task
                        </button>
                    </div>
                </div>

                {/* Internal UI Notes Overlay for Add Task Module */}
                {isNotesOpen && (
                    <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-md z-[120] rounded-[2rem] p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200 border border-slate-700/50" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center px-1">
                            <div className="flex items-center gap-2">
                                <h3 className="text-emerald-500 text-xs font-black tracking-widest uppercase">Notes</h3>
                                <span className={`text-[10px] font-bold ${notes.length >= 500 ? 'text-red-500' : 'text-slate-500'}`}>{notes.length}/500</span>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); setIsNotesOpen(false); }} className="text-slate-500 hover:text-slate-300 p-1 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <textarea 
                            ref={notesTextareaRef}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            maxLength={500}
                            className="flex-1 w-full bg-slate-800/40 rounded-xl p-4 border border-slate-700/50 text-slate-100 text-sm font-bold resize-none outline-none focus:border-blue-500/50 transition-colors leading-relaxed"
                            placeholder="Write your notes here... (max 500 characters)"
                        />
                        
                        <div className="flex justify-end items-center px-1">
                            <button onClick={(e) => { e.stopPropagation(); setIsNotesOpen(false); }} className="text-slate-400 hover:text-emerald-500 text-xs font-bold uppercase tracking-wider transition-colors px-4 py-2 bg-slate-800 border border-slate-700/50 hover:border-emerald-500/50 rounded-lg shadow-sm">
                                Save
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// --- Badges & Rewards Modal Component ---
function BadgesModal({ isOpen, onClose, userRole, rewards }) {
    const [activeView, setActiveView] = React.useState('badges');
    const [clickedRewardId, setClickedRewardId] = React.useState(null);

    React.useEffect(() => {
        if (isOpen) {
            setActiveView('badges');
            setClickedRewardId(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const WORKER_BADGES = [
        { id: '1', name: 'The Closer', req: 'Complete 20 tasks marked as "In Progress".' },
        { id: '2', name: 'Early Bird', req: 'Complete 20 1hr tasks before they are overdue.' },
        { id: '3', name: 'Multitasker', req: 'Have 5 or more active tasks assigned simultaneously.' },
        { id: '4', name: 'Level Up 1', req: 'Complete a total of 30 tasks.' },
        { id: '5', name: 'Level Up 2', req: 'Complete a total of 60 tasks.' },
        { id: '6', name: 'Level Up 3', req: 'Complete a total of 100 tasks.' },
        { id: '7', name: 'Hot Streak', req: 'Complete at least one task every day for 5 consecutive days.' },
        { id: '8', name: 'Reliable', req: 'Go 7 days without a single "Overdue" task status.' },
        { id: '9', name: 'Category King', req: 'Complete at least one task in 10 different unique categories.' },
        { id: '10', name: 'First Blood', req: 'Complete your very first assigned task in the app.' },
        { id: '11', name: 'High Stakes', req: 'Complete 10 tasks that were marked with "P1" priority.' },
        { id: '12', name: 'Quality Control', req: 'Complete 10 tasks that were originally assigned by yourself.' },
        { id: '13', name: 'Burnerman', req: 'Complete 10 tasks that were labeled as backburner.' },
        { id: '14', name: 'Company Badge 1', req: 'Companies can create their own badges.' },
        { id: '15', name: 'Company Badge 2', req: 'Companies can create their own badges.' },
    ];

    const ADMIN_BADGES = [
        { id: 'a1', name: 'The Architect', req: 'Create 10 unique task categories.' },
        { id: 'a2', name: 'Enforcer', req: 'Update or modify 50 tasks created by other users.' },
        { id: 'a3', name: 'Overwatch', req: 'View the "Show All Tasks" list 100 times.' },
        { id: 'a4', name: 'Onboarder', req: 'Successfully register 5 new team members.' },
        { id: 'a5', name: 'Deep Clean', req: 'Delete or purge 20 obsolete tasks from the system.' },
        { id: 'a6', name: 'Director', req: 'Assign tasks to 5 different workers in a single day.' },
        { id: 'a7', name: 'Quality Assurance', req: 'Mark 10 tasks as "Done" that were assigned to workers.' },
    ];

    const badgesToRender = (userRole === 'admin' || userRole === 'super_admin') 
        ? [...WORKER_BADGES, ...ADMIN_BADGES] 
        : WORKER_BADGES;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={onClose}>
            <div className="w-full max-w-4xl bg-slate-900 overflow-hidden rounded-[2rem] border border-slate-700/50 shadow-2xl relative flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                
                {/* Header with Toggle */}
                <div className="p-6 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur z-10">
                    <div className="flex flex-col">
                        <h2 className="text-xl font-black uppercase text-white tracking-widest flex items-center gap-3">
                            {activeView === 'badges' ? (
                                <><Award className="w-6 h-6 text-yellow-500" /> My Badges</>
                            ) : (
                                <><Zap className="w-6 h-6 text-yellow-500" /> My Rewards</>
                            )}
                        </h2>
                        <p className="text-[10px] text-slate-500 font-mono mt-1 uppercase tracking-widest">
                            {activeView === 'badges' 
                                ? 'Badges Gamification System is Under Construction'
                                : 'Rewards System is Under Construction'
                            }
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {activeView === 'badges' ? (
                            <button 
                                onClick={() => { setActiveView('rewards'); setClickedRewardId(null); }}
                                className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30 hover:border-yellow-500 transition-all active:scale-95"
                            >
                                My Rewards
                            </button>
                        ) : (
                            <button 
                                onClick={() => setActiveView('badges')}
                                className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 hover:border-blue-500 transition-all active:scale-95"
                            >
                                My Badges
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-xl transition-all">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto no-scrollbar relative">
                    {activeView === 'badges' ? (
                        /* === MY BADGES VIEW === */
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {badgesToRender.map(badge => (
                                <div 
                                    key={badge.id} 
                                    className="group bg-slate-800/20 hover:bg-slate-900 border border-slate-800/50 hover:border-blue-500 rounded-2xl transition-all relative overflow-hidden h-36 cursor-pointer"
                                >
                                    {/* Default View (Icon + Title) */}
                                    <div className="absolute inset-0 p-4 flex flex-col items-center justify-center transition-opacity duration-300 opacity-100 group-hover:opacity-0 pointer-events-none">
                                        <div className="w-12 h-12 mb-3 rounded-full bg-slate-800 flex items-center justify-center border-2 border-slate-700 shadow-inner">
                                            <Circle className="w-6 h-6 text-slate-600" />
                                        </div>
                                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center leading-tight">
                                            {badge.name}
                                        </h3>
                                    </div>

                                    {/* Hover View (Description) */}
                                    <div className="absolute inset-0 p-4 flex flex-col items-center justify-center transition-opacity duration-300 opacity-0 group-hover:opacity-100 pointer-events-none bg-slate-900 rounded-2xl">
                                        <p className="text-[10px] font-bold text-slate-300 text-center leading-relaxed flex items-center justify-center h-full break-words">
                                            {badge.req}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* === MY REWARDS VIEW === */
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {rewards.map((reward, idx) => {
                                const isSecond = idx === 1;
                                const hasTitle = reward.title && reward.title.trim();
                                const hasReq = reward.requirement && reward.requirement.trim();
                                const hasRewardName = reward.reward && reward.reward.trim();
                                
                                return (
                                    <div 
                                        key={reward.slot} 
                                        className={`group bg-slate-800/20 hover:bg-slate-900 border rounded-2xl transition-all relative overflow-hidden h-36 ${isSecond ? 'cursor-pointer border-yellow-500/30 hover:border-yellow-500' : 'border-slate-800/50 hover:border-slate-600'}`}
                                        onClick={() => {
                                            if (isSecond && hasRewardName) {
                                                setClickedRewardId(clickedRewardId === reward.slot ? null : reward.slot);
                                            }
                                        }}
                                    >
                                        {/* Default View (Icon + Title) */}
                                        <div className="absolute inset-0 p-4 flex flex-col items-center justify-center transition-opacity duration-300 opacity-100 group-hover:opacity-0 pointer-events-none">
                                            <div className={`w-12 h-12 mb-3 rounded-full flex items-center justify-center border-2 shadow-inner ${isSecond ? 'bg-yellow-500/10 border-yellow-500/40' : 'bg-slate-800 border-slate-700'}`}>
                                                <Zap className={`w-6 h-6 ${isSecond ? 'text-yellow-500' : 'text-slate-600'}`} />
                                            </div>
                                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center leading-tight">
                                                {hasTitle ? reward.title : '—'}
                                            </h3>
                                        </div>

                                        {/* Hover View (Requirement) */}
                                        <div className="absolute inset-0 p-4 flex flex-col items-center justify-center transition-opacity duration-300 opacity-0 group-hover:opacity-100 pointer-events-none bg-slate-900 rounded-2xl">
                                            <p className="text-[10px] font-bold text-slate-300 text-center leading-relaxed flex items-center justify-center h-full break-words">
                                                {hasReq ? reward.requirement : 'No requirement set.'}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {clickedRewardId && (() => {
                        const reward = rewards.find(r => r.slot === clickedRewardId);
                        if (!reward || !reward.reward?.trim()) return null;
                        return (
                            <div 
                                className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
                                onClick={() => setClickedRewardId(null)}
                            >
                                <div 
                                    className="bg-slate-800 border border-yellow-500/40 rounded-2xl px-8 py-6 shadow-2xl shadow-yellow-500/10 animate-in zoom-in-95 duration-300 max-w-sm text-center"
                                    onClick={e => e.stopPropagation()}
                                >
                                    <Zap className="w-8 h-8 text-yellow-500 mx-auto mb-3" />
                                    <h3 className="text-lg font-black uppercase tracking-widest text-yellow-400 mb-1">Reward</h3>
                                    <p className="text-white font-bold text-sm">{reward.reward}</p>
                                    <button 
                                        onClick={() => setClickedRewardId(null)}
                                        className="mt-4 px-4 py-1.5 text-[10px] font-bold uppercase text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        );
                    })()}
                </div>

            </div>
        </div>
    );
}

// --- Settings Modal Component ---
function SettingsModal({ isOpen, onClose, initialTab, currentUserRosterName, currentUserProfile, teamMembers, updateTeamMember, updateProfileDetails, updateProfileTheme, userRole, rewards, userSettings, updateUserSetting }) {
    const [activeTab, setActiveTab] = React.useState(initialTab || 'profile');
    const [prefTab, setPrefTab] = React.useState('Notification');
    const [isBadgesModalOpen, setIsBadgesModalOpen] = React.useState(false);
    const [nameInput, setNameInput] = React.useState(currentUserProfile?.name || currentUserRosterName || '');
    const [firstName, setFirstName] = React.useState(currentUserProfile?.first_name || '');
    const [lastName, setLastName] = React.useState(currentUserProfile?.last_name || '');
    const [title, setTitle] = React.useState(currentUserProfile?.title || '');
    const [isSaving, setIsSaving] = React.useState(false);

    React.useEffect(() => {
        if (isOpen) {
            setActiveTab(initialTab || 'profile');
            setNameInput(currentUserProfile?.name || currentUserRosterName || '');
            setFirstName(currentUserProfile?.first_name || '');
            setLastName(currentUserProfile?.last_name || '');
            setTitle(currentUserProfile?.title || '');
            setPrefTab('Notification');
        }
    }, [isOpen, initialTab, currentUserRosterName, currentUserProfile]);

    if (!isOpen) return null;

    const handleSaveProfile = async () => {
        setIsSaving(true);
        
        // 1. Save metadata to profiles table
        if (currentUserProfile?.id) {
            await updateProfileDetails(currentUserProfile.id, {
                name: nameInput.trim(),
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                title: title.trim()
            });
        }

        // 2. Save roster preferred name (Legacy)
        const trimmed = nameInput.trim();
        if (trimmed && trimmed !== currentUserRosterName) {
            const memberRecord = teamMembers.find(m => m.name === currentUserRosterName);
            if (memberRecord) {
                await updateTeamMember(memberRecord.id, trimmed);
            }
        }
        
        setIsSaving(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={onClose}>
            <div className="w-full max-w-2xl bg-slate-900 overflow-hidden rounded-[2rem] border border-slate-700/50 flex shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] relative min-h-[400px]" onClick={e => e.stopPropagation()}>
                
                {/* Close Button */}
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-red-400 transition-colors p-1 z-10">
                    <X className="w-5 h-5" />
                </button>

                {activeTab === 'profile' ? (
                    <div className="w-full flex flex-col p-8">
                        <h2 className="text-xl font-black uppercase text-white mb-6 tracking-widest flex items-center gap-3">
                            <User className="w-6 h-6 text-blue-500" /> My Profile
                        </h2>
                        
                        <div className="flex flex-col md:flex-row gap-8 flex-1">
                            {/* Left Column: Photo Area */}
                            <div className="flex flex-col items-center justify-start pt-4 w-full md:w-1/3">
                                <button 
                                    className="w-24 h-24 rounded-full border-2 border-dashed border-slate-600 hover:border-blue-400 bg-slate-800/80 flex items-center justify-center group relative overflow-hidden shadow-lg transition-all"
                                    onClick={() => alert('Profile Photo uploading is under construction.')}
                                >
                                    <Pencil className="w-6 h-6 text-slate-500 group-hover:text-blue-400 transition-colors absolute z-10" />
                                    <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                                <p className="text-[10px] text-slate-500 mt-3 uppercase tracking-widest font-black text-center">
                                    Profile Photo
                                </p>

                                <button 
                                    onClick={() => setIsBadgesModalOpen(true)}
                                    className="mt-8 flex flex-col items-center justify-center gap-2 group hover:scale-[1.02] active:scale-95 transition-all outline-none"
                                >
                                    <div className="w-12 h-12 rounded-full border border-yellow-500/30 bg-yellow-500/10 flex items-center justify-center group-hover:bg-yellow-500/20 group-hover:border-yellow-500 transition-all shadow-[0_0_15px_-3px_rgba(234,179,8,0.2)] group-hover:shadow-[0_0_20px_-3px_rgba(234,179,8,0.4)]">
                                        <Award className="w-6 h-6 text-yellow-500 group-hover:text-yellow-400 transition-colors" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-yellow-400 transition-colors text-center leading-tight">
                                        Badges and Rewards
                                    </span>
                                </button>
                            </div>

                            {/* Right Column: Inputs */}
                            <div className="space-y-4 w-full md:w-2/3">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">First Name</label>
                                        <input 
                                            type="text"
                                            value={firstName}
                                            onChange={(e) => setFirstName(e.target.value)}
                                            className="w-full bg-slate-800/80 border border-slate-700 text-white rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors text-sm"
                                            placeholder="First Name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Last Name</label>
                                        <input 
                                            type="text"
                                            value={lastName}
                                            onChange={(e) => setLastName(e.target.value)}
                                            className="w-full bg-slate-800/80 border border-slate-700 text-white rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors text-sm"
                                            placeholder="Last Name"
                                        />
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Professional Title</label>
                                    <input 
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="w-full bg-slate-800/80 border border-slate-700 text-white rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors text-sm"
                                        placeholder="e.g. Lead Editor, Project Manager..."
                                    />
                                </div>

                                <div className="pt-4 mt-4 border-t border-slate-800/50">
                                    <label className="block text-[10px] font-black text-blue-400/80 uppercase tracking-widest mb-1.5 ml-1">System Preferred Name</label>
                                    <input 
                                        type="text"
                                        value={nameInput}
                                        onChange={(e) => setNameInput(e.target.value)}
                                        className="w-full bg-slate-800/40 border border-blue-900/30 text-slate-300 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors text-sm"
                                        placeholder="Enter your display name..."
                                    />
                                    <p className="text-[9px] text-slate-500 mt-2 font-mono ml-1">
                                        Changing your system preferred name will automatically mass-update all tasks assigned to you.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-6 border-t border-slate-800 mt-6">
                            <button 
                                onClick={handleSaveProfile}
                                disabled={isSaving || !nameInput.trim()}
                                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-xl transition-all active:scale-95 shadow-lg flex items-center gap-2 text-sm"
                            >
                                {isSaving ? "Saving..." : "Save Profile"}
                            </button>
                        </div>
                    </div>
                ) : (
                    // PREFERENCES TAB VIEW (Dual Column)
                    <div className="w-full flex h-full min-h-[450px]">
                        {/* Sidebar */}
                        <div className="w-48 bg-slate-800/50 border-r border-slate-800 p-4 shrink-0 flex flex-col gap-2">
                            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2 pl-2 mt-4">Preferences</h3>
                            
                            {[
                                { id: 'Notification', icon: Bell },
                                { id: 'Home', icon: LayoutDashboard },
                                { id: 'Appearance', icon: Palette },
                                { id: 'Advanced', icon: Shield }
                            ].map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => setPrefTab(item.id)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${prefTab === item.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                                >
                                    <item.icon className="w-4 h-4" /> {item.id}
                                </button>
                            ))}
                        </div>
                        
                        {/* Main Content Pane */}
                        <div className="flex-1 p-8 flex flex-col bg-slate-900/80">
                            <h2 className="text-xl font-black uppercase text-white mb-6 tracking-widest flex items-center gap-3">
                                {prefTab}
                            </h2>
                            {prefTab === 'Appearance' ? (
                                <div className="flex-1 flex flex-col gap-6">
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <button 
                                            onClick={() => updateProfileTheme(currentUserProfile.id, 'dark')}
                                            className={`p-4 rounded-2xl border-2 text-left transition-all ${currentUserProfile?.theme === 'dark' || !currentUserProfile?.theme ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 bg-slate-800/30 hover:border-slate-600'}`}
                                        >
                                            <h3 className="text-white font-bold tracking-widest uppercase text-sm mb-1">Dark Mode</h3>
                                            <p className="text-slate-500 text-[10px] uppercase font-bold">Midnight Blue & Charcoal</p>
                                        </button>

                                        <button 
                                            onClick={() => updateProfileTheme(currentUserProfile.id, 'oatmeal')}
                                            className={`p-4 rounded-2xl border-2 text-left transition-all ${currentUserProfile?.theme === 'oatmeal' ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 bg-slate-800/30 hover:border-slate-600'}`}
                                        >
                                            <h3 className="text-white font-bold tracking-widest uppercase text-sm mb-1">Oatmeal</h3>
                                            <p className="text-slate-500 text-[10px] uppercase font-bold">Calm, Warm Stone, Professional</p>
                                        </button>

                                        <button 
                                            onClick={() => updateProfileTheme(currentUserProfile.id, 'noir')}
                                            className={`p-4 rounded-2xl border-2 text-left transition-all ${currentUserProfile?.theme === 'noir' ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 bg-slate-800/30 hover:border-slate-600'}`}
                                        >
                                            <h3 className="text-white font-bold tracking-widest uppercase text-sm mb-1">Noir</h3>
                                            <p className="text-slate-500 text-[10px] uppercase font-bold">Absolute Black & Pure White</p>
                                        </button>

                                        <button 
                                            onClick={() => updateProfileTheme(currentUserProfile.id, 'cool-yellow')}
                                            className={`p-4 rounded-2xl border-2 text-left transition-all ${currentUserProfile?.theme === 'cool-yellow' ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 bg-slate-800/30 hover:border-slate-600'}`}
                                        >
                                            <h3 className="text-white font-bold tracking-widest uppercase text-sm mb-1">Cool Yellow</h3>
                                            <p className="text-slate-500 text-[10px] uppercase font-bold">Yellow, Royal Blue Tint</p>
                                        </button>

                                        {/* Theme 5 — Futuristic (LOCKED) */}
                                        <div className="group relative p-4 rounded-2xl border-2 border-dashed border-slate-700/50 bg-slate-800/20 text-left transition-all cursor-not-allowed overflow-hidden">
                                            <h3 className="text-slate-500 font-bold tracking-widest uppercase text-sm mb-1">Futuristic</h3>
                                            <p className="text-slate-600 text-[10px] uppercase font-bold">Bright, Minimal, Clean</p>
                                            {/* Default LOCKED overlay */}
                                            <div className="absolute inset-0 flex items-center justify-center transition-opacity duration-300 opacity-100 group-hover:opacity-0 pointer-events-none">
                                                <span className="text-2xl font-black uppercase tracking-[0.3em] text-white/15 select-none">LOCKED</span>
                                            </div>
                                            {/* Hover unlock requirement overlay */}
                                            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 rounded-2xl transition-opacity duration-300 opacity-0 group-hover:opacity-100 pointer-events-none">
                                                <span className="text-[11px] font-bold uppercase tracking-widest text-blue-400 text-center px-4">Complete 50 Tasks to Unlock</span>
                                            </div>
                                        </div>

                                        {/* Theme 6 — 90's Vibe (LOCKED) */}
                                        <div className="group relative p-4 rounded-2xl border-2 border-dashed border-slate-700/50 bg-slate-800/20 text-left transition-all cursor-not-allowed overflow-hidden">
                                            <h3 className="text-slate-500 font-bold tracking-widest uppercase text-sm mb-1">90's Vibe</h3>
                                            <p className="text-slate-600 text-[10px] uppercase font-bold">Nostalgic & Colorful</p>
                                            {/* Default LOCKED overlay */}
                                            <div className="absolute inset-0 flex items-center justify-center transition-opacity duration-300 opacity-100 group-hover:opacity-0 pointer-events-none">
                                                <span className="text-2xl font-black uppercase tracking-[0.3em] text-white/15 select-none">LOCKED</span>
                                            </div>
                                            {/* Hover unlock requirement overlay */}
                                            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 rounded-2xl transition-opacity duration-300 opacity-0 group-hover:opacity-100 pointer-events-none">
                                                <span className="text-[11px] font-bold uppercase tracking-widest text-blue-400 text-center px-4">Complete 100 Tasks to Unlock</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-8 border-2 border-dashed border-slate-800 rounded-2xl flex items-center justify-center p-6 text-center text-slate-500 font-mono text-xs">
                                        Check back soon for MORE customizable settings.
                                    </div>
                                </div>
                            ) : prefTab === 'Advanced' ? (
                                <div className="flex-1 flex flex-col items-center justify-center px-6">
                                    <div className="w-full max-w-md bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 transition-all hover:bg-slate-800/50 mb-4">
                                        <h3 className="text-white font-black tracking-widest uppercase text-sm mb-4">Enable Drag &amp; Drop Task Cards</h3>
                                        <div className="flex flex-col gap-4">
                                            {/* Mobile toggle */}
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-slate-300 text-xs font-bold uppercase tracking-wider">Mobile</p>
                                                    <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Touch drag on mobile devices</p>
                                                </div>
                                                <button
                                                    onClick={() => updateUserSetting(currentUserProfile.id, 'dnd_mobile_enabled', !(userSettings?.dnd_mobile_enabled ?? true))}
                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${(userSettings?.dnd_mobile_enabled ?? true) ? 'bg-blue-500' : 'bg-slate-600'}`}
                                                >
                                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${(userSettings?.dnd_mobile_enabled ?? true) ? 'translate-x-6' : 'translate-x-1'}`} />
                                                </button>
                                            </div>
                                            <div className="h-px bg-slate-700/50" />
                                            {/* Desktop toggle */}
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-slate-300 text-xs font-bold uppercase tracking-wider">Desktop</p>
                                                    <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Pointer drag on desktop</p>
                                                </div>
                                                <button
                                                    onClick={() => updateUserSetting(currentUserProfile.id, 'dnd_desktop_enabled', !(userSettings?.dnd_desktop_enabled))}
                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${userSettings?.dnd_desktop_enabled ? 'bg-blue-500' : 'bg-slate-600'}`}
                                                >
                                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${userSettings?.dnd_desktop_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-auto border-2 border-dashed border-slate-800 rounded-2xl flex items-center justify-center w-full max-w-md p-6 text-center">
                                        <p className="text-slate-500 font-mono text-xs leading-relaxed">
                                            Advanced Settings is under construction.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 border-2 border-dashed border-slate-800 rounded-2xl flex items-center justify-center p-6 text-center">
                                    <p className="text-slate-500 font-mono text-xs leading-relaxed">
                                        <span className="text-blue-400 font-bold">{prefTab}</span> is under construction.
                                        <br/><br/>
                                        Check back soon for customizable settings.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <BadgesModal 
                isOpen={isBadgesModalOpen} 
                onClose={() => setIsBadgesModalOpen(false)} 
                userRole={userRole}
                rewards={rewards}
            />
        </div>
    );
}

// --- Admin Settings Modal Component ---
function AdminSettingsModal({ isOpen, onClose, initialTab, userRole, profiles, teamMembers, updateProfileRole, terminateProfile, rewards, updateReward, session, companyName, updateCompanyName, categories, addCategory, updateCategory, deleteCategory }) {
    const [activeTab, setActiveTab] = React.useState(initialTab || 'Invite Team');
    const [localName, setLocalName] = React.useState(companyName || 'TEAM ROOXTER');
    const [isSavingName, setIsSavingName] = React.useState(false);

    React.useEffect(() => {
        setLocalName(companyName || 'TEAM ROOXTER');
    }, [companyName, isOpen]);

    React.useEffect(() => {
        if (isOpen && initialTab) {
            setActiveTab(initialTab);
        }
    }, [isOpen, initialTab]);

    if (!isOpen) return null;

    // Build the sidebar tabs dynamically based on role
    const sidebarTabs = [];
    sidebarTabs.push({ id: 'Invite Team', icon: UserPlus });
    sidebarTabs.push({ id: 'Users and Roles', icon: Users });
    
    // Project Management (formerly Team Management) is for everyone with auth rules
    if (userRole === 'admin') {
        sidebarTabs.push({ id: 'Project Management', icon: FolderKanban });
    }
    
    sidebarTabs.push({ id: 'System Settings', icon: Settings });
    
    if (userRole === 'super_admin') {
        sidebarTabs.push({ id: 'Company Management', icon: FolderKanban }); // formerly Project Management
        sidebarTabs.push({ id: 'Project Management', icon: FolderKanban }); // formerly Team Management
        sidebarTabs.push({ id: 'Billing Management', icon: FileText });
    }
    sidebarTabs.push({ id: 'Reward System', icon: Zap });
    sidebarTabs.push({ id: 'Reward System', icon: Zap });

    const renderMainContent = () => {
        if (activeTab === 'Company Management' && userRole === 'super_admin') {
            const handleSaveName = async () => {
                const trimmed = localName.trim();
                if (!trimmed || trimmed === companyName) return;
                setIsSavingName(true);
                await updateCompanyName(trimmed, session?.user?.id);
                setIsSavingName(false);
            };

            return (
                <div className="w-full h-full flex flex-col p-8 bg-slate-900 rounded-r-3xl relative">
                    <h2 className="text-xl font-black uppercase tracking-widest text-white mb-6 flex items-center gap-3">
                        <FolderKanban className="w-6 h-6 text-indigo-400" /> Company Management
                    </h2>
                    
                    <div className="flex-1 overflow-y-auto no-scrollbar pt-4 flex flex-col">
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 mb-8 text-amber-200/80 font-medium">
                            Company Management for Super Admin is under construction.
                        </div>

                        <div className="bg-slate-800/50 border border-slate-700/50 rounded-3xl p-6 mt-auto">
                            <h3 className="text-sm font-black uppercase text-slate-300 tracking-widest pl-2 border-l-2 border-indigo-500 mb-2">Global Team Name</h3>
                            <p className="text-xs text-slate-500 mb-6">Edit the organizational Team Name displayed at the top of the application for all users across the platform.</p>
                            
                            <div className="flex items-center gap-4">
                                <input 
                                    type="text" 
                                    value={localName} 
                                    onChange={e => setLocalName(e.target.value)}
                                    maxLength={30}
                                    placeholder="Enter your team or company name..."
                                    className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-colors text-sm font-medium"
                                />
                                <button 
                                    onClick={handleSaveName}
                                    disabled={isSavingName || !localName.trim() || localName === companyName}
                                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95 min-w-[120px]"
                                >
                                    {isSavingName ? "Saving..." : "Save Name"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        if (activeTab === 'Project Management' && (userRole === 'admin' || userRole === 'super_admin')) {
            const handleAddCategory = () => {
                const el = document.getElementById('new-global-category-input');
                const val = el?.value?.trim();
                if (val) {
                    addCategory(val, null);
                    el.value = '';
                }
            };

            return (
                <div className="w-full h-full flex flex-col p-8 bg-slate-900 rounded-r-3xl relative">
                    <h2 className="text-xl font-black uppercase tracking-widest text-white mb-6 flex items-center gap-3">
                        <FolderKanban className="w-6 h-6 text-indigo-400" /> Project Management
                    </h2>
                    
                    <div className="flex-1 overflow-y-auto no-scrollbar pt-4 flex flex-col">
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 mb-8 text-amber-200/80 font-medium">
                            Project Management for {userRole === 'admin' ? 'ADMIN' : 'SUPER ADMIN'} is under construction.
                        </div>

                        <div className="bg-slate-800/50 border border-slate-700/50 rounded-3xl p-6">
                            <h3 className="text-sm font-black uppercase text-slate-300 tracking-widest pl-2 border-l-2 border-indigo-500 mb-2">Category Management</h3>
                            <p className="text-xs text-slate-500 mb-6">Create, edit, or delete global categories. These will be available to all users across the platform.</p>
                            
                            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto mb-6 p-2 bg-slate-900 rounded-xl">
                                {categories.filter(c => !c.created_by).length === 0 ? (
                                    <div className="text-slate-500 text-sm italic p-4 text-center">No categories found. Create one below.</div>
                                ) : (
                                    categories.filter(c => !c.created_by).map(cat => (
                                        <div key={cat.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-colors group">
                                            <input 
                                                type="text" 
                                                defaultValue={cat.name} 
                                                onBlur={(e) => {
                                                    const val = e.target.value.trim();
                                                    if (val && val !== cat.name) {
                                                        updateCategory(cat.id, val);
                                                    }
                                                }}
                                                onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                                className="bg-transparent text-slate-300 text-sm font-bold outline-none w-full focus:text-indigo-400 transition-colors px-2 py-1"
                                                title="Click to edit"
                                            />
                                            <button 
                                                onClick={() => deleteCategory(cat.id)} 
                                                className="text-slate-600 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                title="Delete category"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                            
                            <div className="flex items-center gap-4 border-t border-slate-700/50 pt-6">
                                <input 
                                    type="text" 
                                    id="new-global-category-input"
                                    placeholder="Enter new category name..."
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); }}
                                    className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-colors text-sm font-medium"
                                />
                                <button 
                                    onClick={handleAddCategory}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95 min-w-[120px]"
                                >
                                    + Add
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        if (activeTab === 'Invite Team') {
            return (
                <div className="w-full h-full flex flex-col">
                    <h2 className="text-xl font-black uppercase text-white mb-6 tracking-widest flex items-center gap-3">
                        <UserPlus className="w-6 h-6 text-blue-500" /> Invite Team
                    </h2>
                    <div className="flex-1 flex justify-center items-start pt-8">
                        {/* We just inject the component straight up! */}
                        <InviteMemberForm />
                    </div>
                </div>
            );
        }

        if (activeTab === 'Users and Roles' && (userRole === 'super_admin' || userRole === 'admin')) {
            const handleRoleChange = (p, newRole) => {
                updateProfileRole(p.id, newRole);
            };

            const sortedProfiles = [...profiles].sort((a, b) => {
                const roleWeight = { 'super_admin': 1, 'admin': 2, 'worker': 3 };
                const weightA = roleWeight[a.role] || 99;
                const weightB = roleWeight[b.role] || 99;
                
                if (weightA !== weightB) {
                    return weightA - weightB;
                }
                
                const getDisplayName = (p) => {
                    const name = p.name || teamMembers?.find(m => m.user_id === p.id)?.name || p.email || '';
                    return name.toLowerCase();
                };
                
                const nameA = getDisplayName(a);
                const nameB = getDisplayName(b);
                
                if (nameA < nameB) return -1;
                if (nameA > nameB) return 1;
                return 0;
            });

            return (
                <div className="w-full h-full flex flex-col">
                    <h2 className="text-xl font-black uppercase text-white mb-6 tracking-widest flex items-center gap-3">
                        <Users className="w-6 h-6 text-blue-500" /> USERS & ROLES
                    </h2>
                    <div className="flex-1 overflow-y-auto no-scrollbar pt-2 pr-2">
                        {(!profiles || profiles.length === 0) ? (
                            <p className="text-slate-500 italic text-sm">No profiles found.</p>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-800/80 sticky top-0 z-10 backdrop-blur-md pb-4">
                                    <tr className="text-[10px] text-slate-400 uppercase tracking-widest font-bold border-b border-slate-700/50">
                                        <th className="py-1.5 px-2">Display Name</th>
                                        <th className="py-1.5 px-2">First Name</th>
                                        <th className="py-1.5 px-2">Last Name</th>
                                        <th className="py-1.5 px-2">Title</th>
                                        <th className="py-1.5 px-2 text-center">Role</th>
                                        <th className="py-1.5 px-2">Email</th>
                                        {(userRole === 'super_admin' || userRole === 'admin') && (
                                            <th className="py-1.5 px-2 text-right">Delete</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {sortedProfiles.map(p => (
                                        <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="py-1.5 px-2 text-xs font-bold text-blue-300">
                                                {p.name || teamMembers?.find(m => m.user_id === p.id)?.name || p.email}
                                            </td>
                                            <td className="py-1.5 px-2 text-xs text-slate-300">{p.first_name || '-'}</td>
                                            <td className="py-1.5 px-2 text-xs text-slate-300">{p.last_name || '-'}</td>
                                            <td className="py-1.5 px-2 text-xs text-slate-400 italic">{p.title || '-'}</td>
                                            <td className="py-1.5 px-2 text-center">
                                                <select
                                                    value={p.role}
                                                    onChange={(e) => handleRoleChange(p, e.target.value)}
                                                    className={`bg-slate-900 border appearance-none text-center px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer outline-none transition-colors ${p.role === 'super_admin' ? 'text-purple-400 border-purple-500/30' : p.role === 'admin' ? 'text-emerald-400 border-emerald-500/30' : 'text-slate-400 border-slate-700'}`}
                                                    disabled={p.role === 'super_admin'}
                                                >
                                                    <option value="worker">Worker</option>
                                                    <option value="admin">Admin</option>
                                                    <option value="super_admin" disabled>Super Admin</option>
                                                </select>
                                            </td>
                                            <td className="py-1.5 px-2 text-xs text-slate-500 font-mono">
                                                {p.email}
                                            </td>
                                            {(userRole === 'super_admin' || userRole === 'admin') && (
                                                <td className="py-1.5 px-2 text-right">
                                                    <button
                                                        onClick={() => terminateProfile(p.id, p.email)}
                                                        disabled={p.role === 'super_admin'}
                                                        className="p-1.5 text-slate-500 hover:text-red-500 transition-colors disabled:opacity-20 disabled:hover:text-slate-500 rounded-lg hover:bg-red-500/10"
                                                        title="Terminate Profile"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            );
        }

        if (activeTab === 'Reward System') {
            const handleRewardChange = (slot, field, value) => {
                updateReward(slot, field, value, session?.user?.email, userRole);
            };

            return (
                <div className="w-full h-full flex flex-col">
                    <h2 className="text-xl font-black uppercase text-white mb-2 tracking-widest flex items-center gap-3">
                        <Zap className="w-6 h-6 text-yellow-500" /> Reward System
                    </h2>
                    <p className="text-[10px] text-slate-500 font-mono mb-6 uppercase tracking-widest">
                        Reward System for {userRole === 'super_admin' ? 'SUPER ADMIN' : 'ADMIN'} is under construction. This is just a sample.
                    </p>
                    <div className="flex-1 overflow-y-auto no-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-800/80 sticky top-0 z-10 backdrop-blur-md">
                                <tr className="text-[10px] text-slate-400 uppercase tracking-widest font-bold border-b border-slate-700/50">
                                    <th className="py-3 px-3 w-8 text-center">#</th>
                                    <th className="py-3 px-3">Reward Title</th>
                                    <th className="py-3 px-3">Requirements</th>
                                    <th className="py-3 px-3">Reward</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {rewards.map((reward, idx) => (
                                    <tr key={reward.slot} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="py-2 px-3 text-[10px] font-bold text-slate-500 text-center">{idx + 1}</td>
                                        <td className="py-2 px-3">
                                            <input
                                                type="text"
                                                value={reward.title}
                                                onChange={(e) => handleRewardChange(reward.slot, 'title', e.target.value)}
                                                placeholder={idx === 0 ? 'e.g. Critical Chief' : ''}
                                                className="w-full bg-slate-800/60 border border-slate-700 text-white rounded-lg px-3 py-2 outline-none focus:border-yellow-500 transition-colors text-xs placeholder:text-slate-600"
                                            />
                                        </td>
                                        <td className="py-2 px-3">
                                            <input
                                                type="text"
                                                value={reward.requirement}
                                                onChange={(e) => handleRewardChange(reward.slot, 'requirement', e.target.value)}
                                                placeholder={idx === 0 ? 'e.g. Resolve 10 "P1" tasks' : ''}
                                                className="w-full bg-slate-800/60 border border-slate-700 text-white rounded-lg px-3 py-2 outline-none focus:border-yellow-500 transition-colors text-xs placeholder:text-slate-600"
                                            />
                                        </td>
                                        <td className="py-2 px-3">
                                            <input
                                                type="text"
                                                value={reward.reward}
                                                onChange={(e) => handleRewardChange(reward.slot, 'reward', e.target.value)}
                                                placeholder={idx === 0 ? 'e.g. Large Cup of Coffee' : ''}
                                                className="w-full bg-slate-800/60 border border-slate-700 text-white rounded-lg px-3 py-2 outline-none focus:border-yellow-500 transition-colors text-xs placeholder:text-slate-600"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        }

        // Placeholder fallback
        return (
            <div className="flex-1 flex flex-col">
                <h2 className="text-xl font-black uppercase text-white mb-6 tracking-widest flex items-center gap-3">
                    {activeTab}
                </h2>
                <div className="flex-1 border-2 border-dashed border-slate-800 rounded-2xl flex items-center justify-center p-6 text-center">
                    <p className="text-slate-500 font-mono text-xs leading-relaxed max-w-sm">
                        <span className="text-blue-400 font-bold">{activeTab}</span> for <span className="uppercase">{userRole === 'super_admin' ? 'Super Admin' : 'Admin'}</span> is under construction.
                    </p>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={onClose}>
            <div className="w-full max-w-5xl bg-slate-900 overflow-hidden rounded-[2rem] border border-slate-700/50 flex shadow-[0_30px_80px_-15px_rgba(0,0,0,1)] relative min-h-[500px]" onClick={e => e.stopPropagation()}>
                
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-red-400 transition-colors p-1 z-10">
                    <X className="w-5 h-5" />
                </button>

                <div className="w-full flex h-[80vh] max-h-[700px]">
                    {/* Admin Sidebar */}
                    <div className="w-56 bg-slate-800/50 border-r border-slate-800 p-4 shrink-0 flex flex-col gap-2 overflow-y-auto no-scrollbar">
                        <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2 pl-2 mt-4 text-center">System Module</h3>
                        
                        {sidebarTabs.map(item => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === item.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                            >
                                <item.icon className="w-4 h-4" /> {item.id}
                            </button>
                        ))}
                    </div>
                    
                    {/* Main Content Pane */}
                    <div className="flex-1 p-8 bg-slate-900/80 overflow-y-auto no-scrollbar">
                        {renderMainContent()}
                    </div>
                </div>
            </div>
        </div>
    );
}

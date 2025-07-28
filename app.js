document.addEventListener('DOMContentLoaded', () => {
    const { createClient } = supabase;
    const SUPABASE_URL = 'https://xdrzsunisujjrghjntnn.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkcnpzdW5pc3VqanJnaGpudG5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyNjYyODcsImV4cCI6MjA2ODg0MjI4N30.jAZA8q2niY7MTO7jolyKAPiFcRVmKu2-ObSrCoXfhGk';
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // --- GLOBAL STATE & DOM REFERENCES ---
    const body = document.body;
    const userProfileContainer = document.getElementById('user-profile-container');
    const activeProjectDisplay = document.getElementById('active-project-display');
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const authEmailInput = document.getElementById('auth-email');
    const authPasswordInput = document.getElementById('auth-password');
    const authLanguageSelect = document.getElementById('auth-language');

    let currentTranslations = {};
    let isAppInitialized = false;
    let activeProject = null;
    let ao_keywords = [];
    let ao_currentResults = [];

    // --- TRANSLATION & AUTH UI FUNCTIONS ---
    const translatePage = async (lang) => {
        try {
            const response = await fetch(`./lang/${lang}.json`);
            if (!response.ok) return;
            const translations = await response.json();
            currentTranslations = translations;
            document.querySelectorAll('[data-translate-key]').forEach(el => {
                const key = el.getAttribute('data-translate-key');
                if (translations[key]) {
                     const target = el.placeholder !== undefined && el.placeholder !== null ? 'placeholder' : 'innerHTML';
                     el[target] = translations[key];
                }
            });
            document.title = translations['app_title'] || 'OutreachSuite';
            const langEnBtn = document.getElementById('lang-en');
            const langEsBtn = document.getElementById('lang-es');
            if (langEnBtn && langEsBtn) {
                langEnBtn.classList.toggle('bg-white', lang === 'en');
                langEnBtn.classList.toggle('text-slate-800', lang === 'en');
                langEsBtn.classList.toggle('bg-white', lang === 'es');
                langEsBtn.classList.toggle('text-slate-800', lang === 'es');
            }
        } catch(e) { console.error("Translation Error:", e); }
    };

    const showAuthMessage = (message, type = 'error') => {
        const div = document.getElementById(type === 'error' ? 'auth-error' : 'auth-success');
        document.getElementById('auth-error').classList.add('hidden');
        document.getElementById('auth-success').classList.add('hidden');
        div.textContent = message;
        div.classList.remove('hidden');
    };

    const updateUserAvatar = (user) => {
        let initials = (user.email?.substring(0, 2) || '??').toUpperCase();
        const meta = user.user_metadata;
        if (meta?.first_name && meta?.last_name && meta.first_name.length > 0 && meta.last_name.length > 0) {
            initials = (meta.first_name[0] + meta.last_name[0]).toUpperCase();
        }
        userProfileContainer.innerHTML = `
            <button id="user-avatar-btn" class="w-10 h-10 bg-slate-700 text-white font-bold rounded-full flex items-center justify-center">${initials}</button>
            <div id="user-dropdown-menu" class="dropdown-menu hidden absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-20">
                <div class="px-4 py-2 border-b"><p class="text-sm font-semibold text-gray-700 truncate">${meta?.first_name || 'User'}</p><p class="text-xs text-gray-500 truncate">${user.email}</p></div>
                <a href="#settings" class="sidebar-link-in-menu block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" data-translate-key="nav_settings">Settings</a>
                <a href="#" id="logout-btn" class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" data-translate-key="logout_btn">Logout</a>
            </div>
        `;
    };
    
    // =================================================================================
    // 🚀 APP INITIALIZATION
    // =================================================================================
    const initializeApp = async (user) => {
        if (isAppInitialized) return;
        isAppInitialized = true;
        
        // --- NAVIGATION & VIEW HANDLING ---
        const views = document.querySelectorAll('.view');
        const navLinks = document.querySelectorAll('.sidebar-link');
        const viewSwitchers = document.querySelectorAll('.view-switcher');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        const mobileMenuButton = document.getElementById('mobile-menu-button');
        const closeMenuButton = document.getElementById('close-menu-button');

        const toggleMenu = () => {
            sidebar.classList.toggle('-translate-x-full');
            overlay.classList.toggle('hidden');
        };
        const showView = (viewId) => {
            views.forEach(view => view.classList.add('hidden'));
            const targetView = document.getElementById(viewId + '-view');
            if(targetView) targetView.classList.remove('hidden'); else document.getElementById('home-view').classList.remove('hidden');
            navLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === '#' + viewId));
            window.scrollTo(0, 0); 
            if(viewId === 'projects') loadProjects(user);
        };
        window.showOutreachSuiteView = showView;
        
        const handleLinkClick = (e) => {
            e.preventDefault();
            const viewId = e.currentTarget.getAttribute('href').substring(1);
            window.location.hash = viewId;
            if (window.innerWidth < 768 && !sidebar.classList.contains('-translate-x-full')) {
                toggleMenu();
            }
        };

        window.addEventListener('hashchange', () => {
            const viewId = window.location.hash ? window.location.hash.substring(1) : 'home';
            showView(viewId);
        });

        mobileMenuButton.addEventListener('click', toggleMenu);
        closeMenuButton.addEventListener('click', toggleMenu);
        overlay.addEventListener('click', toggleMenu);
        navLinks.forEach(link => link.addEventListener('click', handleLinkClick));
        viewSwitchers.forEach(switcher => switcher.addEventListener('click', handleLinkClick));
        
        const initialView = window.location.hash ? window.location.hash.substring(1) : 'home';
        showView(initialView);
        
        // --- USER PROFILE & LANGUAGE EVENT LISTENERS ---
        const userProfileButton = document.getElementById('user-avatar-btn');
        if (userProfileButton) {
            userProfileButton.addEventListener('click', (e) => {
                e.stopPropagation();
                document.getElementById('user-dropdown-menu').classList.toggle('hidden');
            });
        }

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                sb.auth.signOut();
            });
        }

        document.querySelectorAll('.sidebar-link-in-menu').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                window.showOutreachSuiteView(link.getAttribute('href').substring(1));
                const menu = document.getElementById('user-dropdown-menu');
                if (menu) menu.classList.add('hidden');
            });
        });

        const langEnBtn = document.getElementById('lang-en');
        const langEsBtn = document.getElementById('lang-es');
        if (langEnBtn) {
            langEnBtn.addEventListener('click', () => sb.auth.updateUser({ data: { language: 'en' } }));
        }
        if (langEsBtn) {
            langEsBtn.addEventListener('click', () => sb.auth.updateUser({ data: { language: 'es' } }));
        }

        // --- UTILITY FUNCTION ---
        const normalizeUrl = (url) => { let n = url.trim(); if (!/^(https?:\/\/)/i.test(n) && n) { n = 'https://' + n; } return n; };

        // =================================================================================
        // ⚙️ SETTINGS LOGIC
        // =================================================================================
        const userFirstNameInput = document.getElementById('user-first-name');
        const userLastNameInput = document.getElementById('user-last-name');
        const saveSettingsBtn = document.getElementById('save-settings-btn');
        const settingsSuccessDiv = document.getElementById('settings-success');
        userFirstNameInput.value = user.user_metadata?.first_name || '';
        userLastNameInput.value = user.user_metadata?.last_name || '';
        saveSettingsBtn.addEventListener('click', async () => {
            settingsSuccessDiv.classList.add('hidden');
            const { data, error } = await sb.auth.updateUser({ data: { first_name: userFirstNameInput.value, last_name: userLastNameInput.value } });
            if (error) {
                alert('Error: ' + error.message);
            } else {
                updateUserAvatar(data.user);
                settingsSuccessDiv.textContent = currentTranslations['settings_saved_success'];
                settingsSuccessDiv.classList.remove('hidden');
            }
        });

        // =================================================================================
        // 📝 PROJECTS LOGIC
        // =================================================================================
        const projectForm = document.getElementById('project-form');
        const projectFormTitle = document.getElementById('project-form-title');
        const projectIdInput = document.getElementById('project-id-input');
        const projectNameInput = document.getElementById('project-name');
        const projectUrlInput = document.getElementById('project-url');
        const projectKeywordInput = document.getElementById('project-keyword-input');
        const projectTagsContainer = document.getElementById('project-tags-container');
        const projectSubmitBtn = document.getElementById('project-submit-btn');
        const projectCancelBtn = document.getElementById('project-cancel-btn');
        const projectsListContainer = document.getElementById('projects-list-container');
        
        let projectKeywordsState = [];

        const renderProjectTags = () => {
            projectTagsContainer.innerHTML = ''; 
            projectKeywordsState.forEach(keyword => {
                const tag = document.createElement('div'); tag.className = 'tag'; tag.textContent = keyword;
                const removeBtn = document.createElement('button'); removeBtn.className = 'tag-remove'; removeBtn.innerHTML = '&times;';
                removeBtn.onclick = () => { projectKeywordsState = projectKeywordsState.filter(k => k !== keyword); renderProjectTags(); };
                tag.appendChild(removeBtn); projectTagsContainer.appendChild(tag);
            });
        };
        
        projectKeywordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const newKeyword = projectKeywordInput.value.trim();
                if (newKeyword && !projectKeywordsState.includes(newKeyword)) {
                    projectKeywordsState.push(newKeyword);
                    renderProjectTags();
                }
                projectKeywordInput.value = '';
            }
        });

        const resetProjectForm = () => {
            projectForm.reset();
            projectIdInput.value = '';
            projectKeywordsState = [];
            renderProjectTags();
            projectFormTitle.textContent = currentTranslations['create_project_title'] || "Create a New Project";
            projectSubmitBtn.textContent = currentTranslations['create_project_btn'] || "Create Project";
            projectCancelBtn.classList.add('hidden');
        };
        
        projectCancelBtn.addEventListener('click', resetProjectForm);
        
        const loadProjectDetails = async (projectId) => {
            const contentDiv = document.getElementById(`content-${projectId}`);
            contentDiv.innerHTML = `<div class="p-4 border-t border-gray-200"><p class="text-slate-400">Loading details...</p></div>`;
            
            const { data: project, error } = await sb.from('projects').select('keywords').eq('id', projectId).single();
            const { data: media, error: mediaError } = await sb.from('saved_media').select('*').eq('project_id', projectId).order('created_at', { ascending: false });

            if (error || mediaError) {
                contentDiv.innerHTML = `<div class="p-4 border-t border-gray-200"><p class="text-red-500">Error loading details.</p></div>`;
                return;
            }
            
            let keywordsHtml = '<div><h5 class="font-bold mb-2">Keywords</h5><p class="text-sm text-slate-500">No keywords defined.</p></div>';
            if(project.keywords && project.keywords.length > 0) {
                keywordsHtml = `<div><h5 class="font-bold mb-2">Keywords</h5><div class="flex flex-wrap">${project.keywords.map(k => `<span class="bg-slate-200 text-slate-700 text-xs font-semibold mr-2 mb-2 px-2.5 py-0.5 rounded-full">${k}</span>`).join('')}</div></div>`;
            }
            
            let mediaHtml = '<div><h5 class="font-bold mb-2 mt-4" data-translate-key="saved_media_title">Saved Media</h5><p class="text-sm text-slate-500">No media saved yet.</p></div>';
            if(media.length > 0) {
                mediaHtml = `
                    <div>
                        <div class="flex justify-between items-center mb-2 mt-4">
                            <h5 class="font-bold" data-translate-key="saved_media_title">Saved Media</h5>
                            <button class="export-project-media-btn bg-[#BF103C] text-white text-xs font-bold py-1 px-3 rounded-lg">Export Selected</button>
                        </div>
                        <div class="space-y-2">${media.map(m => `
                            <div class="bg-slate-50 p-2 rounded-lg flex items-center gap-2">
                                <input type="checkbox" class="project-media-checkbox h-4 w-4 text-[#BF103C] border-gray-300 rounded focus:ring-[#BF103C]" data-url="${m.url}">
                                <div class="flex-grow"><p class="font-semibold text-sm text-slate-700">${m.name}</p><a href="${m.url}" target="_blank" rel="noopener noreferrer" class="text-xs text-sky-600 truncate block">${m.url}</a></div>
                                <button class="scrap-contact-btn bg-sky-100 text-sky-700 text-xs font-bold py-1 px-3 rounded-lg" data-url="${m.url}">Scrape Contact</button>
                            </div>
                        `).join('')}</div>
                    </div>
                `;
            }
            
            contentDiv.innerHTML = `<div class="p-4 border-t border-gray-200 space-y-4">${keywordsHtml}${mediaHtml}</div>`;
            contentDiv.dataset.loaded = 'true';
            translatePage(user.user_metadata?.language || 'en');
        };

        const deleteProject = async (projectId) => {
            if (confirm('Are you sure you want to delete this project and all its saved media? This action cannot be undone.')) {
                await sb.from('saved_media').delete().eq('project_id', projectId);
                const { error } = await sb.from('projects').delete().eq('id', projectId);
                if (error) { alert('Error deleting project: ' + error.message); }
                else { if(activeProject && activeProject.id === projectId) activeProject = null; await loadProjects(user); }
            }
        };

        const editProject = (project) => {
            projectFormTitle.textContent = "Edit Project";
            projectSubmitBtn.textContent = "Update Project";
            projectIdInput.value = project.id;
            projectNameInput.value = project.name;
            projectUrlInput.value = project.url;
            projectKeywordsState = [...(project.keywords || [])];
            renderProjectTags();
            projectCancelBtn.classList.remove('hidden');
            projectForm.scrollIntoView({ behavior: 'smooth' });
        };

        const loadProjects = async (user) => {
            const { data: projects, error } = await sb.from('projects').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
            if (error) { alert('Error loading projects: ' + error.message); return; }

            projectsListContainer.innerHTML = '';
            if (projects.length === 0) {
                projectsListContainer.innerHTML = `<div class="text-center py-10 px-6 bg-white rounded-xl shadow-sm"><p data-translate-key="no_projects" class="font-medium text-slate-500">${currentTranslations['no_projects'] || 'No projects found'}</p></div>`;
                activeProject = null;
                activeProjectDisplay.innerHTML = '';
            } else {
                projects.forEach(project => {
                    const accordion = document.createElement('div');
                    accordion.className = 'bg-white rounded-xl shadow-sm';
                    accordion.innerHTML = `
                        <div class="project-accordion-header flex justify-between items-center p-4 cursor-pointer">
                            <div><h4 class="font-bold text-lg text-slate-800">${project.name}</h4><p class="text-sm text-slate-500">${project.url}</p></div>
                            <div class="flex items-center gap-2">
                                <button class="edit-project-btn text-slate-500 hover:text-sky-600 p-2 rounded-full"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828zM5 12V7a2 2 0 012-2h2.586l-4 4H5z"></path></svg></button>
                                <button class="delete-project-btn text-slate-500 hover:text-red-600 p-2 rounded-full"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd"></path></svg></button>
                                <svg class="accordion-arrow w-5 h-5 text-slate-500 transition-transform" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
                            </div>
                        </div>
                        <div class="project-accordion-content" id="content-${project.id}"></div>`;
                    projectsListContainer.appendChild(accordion);
                    
                    accordion.querySelector('.project-accordion-header').addEventListener('click', (e) => { if(!e.target.closest('button')) { const content = accordion.querySelector('.project-accordion-content'); const arrow = accordion.querySelector('.accordion-arrow'); content.classList.toggle('open'); arrow.classList.toggle('open'); if(content.classList.contains('open') && !content.dataset.loaded) { loadProjectDetails(project.id); } } });
                    accordion.querySelector('.edit-project-btn').addEventListener('click', () => editProject(project));
                    accordion.querySelector('.delete-project-btn').addEventListener('click', () => deleteProject(project.id));
                });
                if (!activeProject || !projects.some(p => p.id === activeProject.id)) {
                   activeProject = projects[0];
                }
                if (activeProject) {
                   activeProjectDisplay.innerHTML = `<span class="font-normal mr-2">${currentTranslations['active_project'] || 'Active Project:'}</span> <strong>${activeProject.name}</strong>`;
                }
            }
        };
        
        projectsListContainer.addEventListener('click', (e) => {
            const scrapBtn = e.target.closest('.scrap-contact-btn');
            if (scrapBtn) { 
                document.getElementById('urlInput').value = scrapBtn.dataset.url; 
                window.location.hash = 'hybrid-scraper';
            }
            
            const exportBtn = e.target.closest('.export-project-media-btn');
            if (exportBtn) {
                const container = exportBtn.closest('.project-accordion-content');
                const selected = Array.from(container.querySelectorAll('.project-media-checkbox:checked')).map(cb => cb.dataset.url);
                if(selected.length === 0) { alert('Please select media to export.'); return; }
                const textContent = selected.join('\n');
                const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob); link.download = 'exported_project_media.txt';
                link.click(); URL.revokeObjectURL(link.href);
            }
        });

        projectForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = projectNameInput.value;
            const url = normalizeUrl(projectUrlInput.value);
            const keywords = projectKeywordsState;
            const editingId = projectIdInput.value;

            const projectData = { name, url, keywords };

            let error, data;

            if (editingId) {
                const response = await sb.from('projects').update(projectData).eq('id', editingId).select().single();
                error = response.error; data = response.data;
            } else {
                projectData.user_id = user.id;
                const response = await sb.from('projects').insert(projectData).select().single();
                error = response.error; data = response.data;
            }

            if (error) {
                alert('Error saving project: ' + error.message);
            } else {
                resetProjectForm();
                await loadProjects(user);
                if (data) {
                   activeProject = data;
                   activeProjectDisplay.innerHTML = `<span class="font-normal mr-2">${currentTranslations['active_project'] || 'Active Project:'}</span> <strong>${data.name}</strong>`;
                }
            }
        });
        
        // ... (resto de la lógica de los scrapers y affinity) ...
        
        await loadProjects(user);
        // ao_updateSearchDesc();
    };

    // =================================================================================
    // 🔒 AUTHENTICATION CONTROLLER
    // =================================================================================
    sb.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            body.classList.remove('logged-out');
            body.classList.add('logged-in');
            const user = session.user;
            
            updateUserAvatar(user);
            await translatePage(user.user_metadata?.language || 'en');
            
            if (!isAppInitialized) {
                await initializeApp(user);
            }
        } else {
            body.classList.remove('logged-in');
            body.classList.add('logged-out');
            isAppInitialized = false;
            activeProject = null;
            await translatePage(navigator.language.split('-')[0] || 'en');
            activeProjectDisplay.innerHTML = '';
        }
    });

    document.addEventListener('click', (e) => { 
        const menu = document.getElementById('user-dropdown-menu'); 
        if (menu && !menu.classList.contains('hidden') && !e.target.closest('#user-profile-container')) {
             menu.classList.add('hidden');
        }
    });

    loginBtn.addEventListener('click', async () => { 
        const { error } = await sb.auth.signInWithPassword({ email: authEmailInput.value, password: authPasswordInput.value }); 
        if (error) showAuthMessage(error.message); 
    });
    
    signupBtn.addEventListener('click', async () => { 
        const { error } = await sb.auth.signUp({ email: authEmailInput.value, password: authPasswordInput.value, options: { data: { language: authLanguageSelect.value } } }); 
        if (error) showAuthMessage(error.message); 
        else showAuthMessage('Sign up successful! Please check your email.', 'success'); 
    });

    authLanguageSelect.addEventListener('change', (e) => translatePage(e.target.value));
});
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

        document.getElementById('logout-btn')?.addEventListener('click', (e) => { e.preventDefault(); sb.auth.signOut(); });
        document.getElementById('user-avatar-btn')?.addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('user-dropdown-menu').classList.toggle('hidden'); });
        document.querySelectorAll('.sidebar-link-in-menu').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                window.showOutreachSuiteView(e.currentTarget.getAttribute('href').substring(1));
                document.getElementById('user-dropdown-menu')?.classList.add('hidden');
            });
        });
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
            if(targetView) {
                targetView.classList.remove('hidden');
            } else {
                document.getElementById('home-view').classList.remove('hidden');
            }
            navLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === '#' + viewId));
            window.scrollTo(0, 0); 
            
            if(viewId === 'projects') {
                document.getElementById('projects-list-view').classList.remove('hidden');
                document.getElementById('create-edit-project-container').classList.add('hidden');
                loadProjects(user);
            }
            if(viewId === 'affinity-outreach') ao_loadProjectKeywords();
        };
        window.showOutreachSuiteView = showView;
        
        const handleLinkClick = (e) => {
            e.preventDefault();
            const viewId = e.currentTarget.getAttribute('href').substring(1);
            window.location.hash = viewId;
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
        
        // --- LANGUAGE EVENT LISTENERS ---
        document.getElementById('lang-en')?.addEventListener('click', () => sb.auth.updateUser({ data: { language: 'en' } }));
        document.getElementById('lang-es')?.addEventListener('click', () => sb.auth.updateUser({ data: { language: 'es' } }));

        // --- UTILITY FUNCTION ---
        const normalizeUrl = (url) => { let n = url ? url.trim() : ''; if (!/^(https?:\/\/)/i.test(n) && n) { n = 'https://' + n; } return n; };

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
        // 📝 PROJECTS LOGIC (REDESIGNED)
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
        const projectAnalyzeKeywordsBtn = document.getElementById('project-analyze-keywords-btn');
        const projectKeywordLogContainerWrapper = document.getElementById('project-keyword-log-container-wrapper');
        const projectKeywordLogContainer = document.getElementById('project-keyword-log-container');
        const addProjectBtn = document.getElementById('add-project-btn');
        const createEditProjectContainer = document.getElementById('create-edit-project-container');
        const projectsListView = document.getElementById('projects-list-view');
        
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

        const showProjectForm = (show = true) => {
            createEditProjectContainer.classList.toggle('hidden', !show);
            projectsListView.classList.toggle('hidden', show);
            if(show) resetProjectForm();
        };

        addProjectBtn.addEventListener('click', () => showProjectForm(true));
        projectCancelBtn.addEventListener('click', () => showProjectForm(false));

        const resetProjectForm = () => {
            projectForm.reset();
            projectIdInput.value = '';
            projectKeywordsState = [];
            renderProjectTags();
            projectFormTitle.textContent = currentTranslations['create_edit_title_create'] || "Create a New Project";
            projectSubmitBtn.textContent = currentTranslations['create_project_btn'] || "Save Project";
            projectKeywordLogContainerWrapper.classList.add('hidden');
        };
        
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
                                <button class="hs-scrap-contact-btn bg-sky-100 text-sky-700 text-xs font-bold py-1 px-3 rounded-lg" data-url="${m.url}">Scrape Contact</button>
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
                else { if(activeProject && activeProject.id === projectId) { activeProject = null; activeProjectDisplay.innerHTML = ''; } await loadProjects(user); }
            }
        };

        const editProject = (project) => {
            showProjectForm(true);
            projectFormTitle.textContent = `${currentTranslations['create_edit_title_edit'] || "Editing Project"}: ${project.name}`;
            projectSubmitBtn.textContent = currentTranslations['create_project_btn'] || "Save Project";
            projectIdInput.value = project.id;
            projectNameInput.value = project.name;
            projectUrlInput.value = project.url;
            projectKeywordsState = [...(project.keywords || [])];
            renderProjectTags();
        };
        
        projectAnalyzeKeywordsBtn.addEventListener('click', async () => {
            const url = normalizeUrl(projectUrlInput.value);
            if (!url) { alert('Please enter a project URL to analyze.'); return; }
            
            projectKeywordLogContainerWrapper.classList.remove('hidden');
            projectKeywordLogContainer.innerHTML = '';
            const log = (msg) => projectKeywordLogContainer.innerHTML += msg.replace(/\[/g, '<span class="text-cyan-400">[').replace(/\]/g, ']</span>') + '<br>';

            try {
                log('[INFO] Calling keyword generation function...');
                const response = await fetch('/.netlify/functions/generate-keywords', {
                    method: 'POST',
                    body: JSON.stringify({ projectUrl: url })
                });

                // BUG FIX: Handle non-JSON responses (like timeouts)
                if (!response.headers.get('content-type')?.includes('application/json')) {
                    throw new Error("The server response was not in the expected format. The function may have timed out.");
                }

                const data = await response.json();
                
                (data.log || []).forEach(log);

                if (!response.ok) throw new Error(data.error || 'Failed to generate keywords.');
                
                const combined = [...new Set([...projectKeywordsState, ...data.existingKeywords, ...data.opportunityKeywords])];
                projectKeywordsState = combined;
                renderProjectTags();

            } catch(e) { 
                log(`[FATAL] ${e.message}`);
                if (e instanceof SyntaxError) { // This happens on JSON parsing failure
                    log('[FATAL] This is often caused by a function timeout (taking more than 25s). Please try again.');
                }
            }
        });

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
                    const projectCard = document.createElement('div');
                    projectCard.className = 'bg-white rounded-xl shadow-sm border border-gray-200';
                    projectCard.innerHTML = `
                        <div class="project-accordion-header flex justify-between items-center p-4 cursor-pointer">
                            <div><h4 class="font-bold text-lg text-slate-800">${project.name}</h4><p class="text-sm text-slate-500">${project.url || 'No URL'}</p></div>
                            <div class="flex items-center gap-2">
                                <button class="edit-project-btn text-slate-500 hover:text-sky-600 p-2 rounded-full"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828zM5 12V7a2 2 0 012-2h2.586l-4 4H5z"></path></svg></button>
                                <button class="delete-project-btn text-slate-500 hover:text-red-600 p-2 rounded-full"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd"></path></svg></button>
                                <svg class="accordion-arrow w-5 h-5 text-slate-500 transition-transform" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
                            </div>
                        </div>
                        <div class="project-accordion-content" id="content-${project.id}"></div>`;
                    projectsListContainer.appendChild(projectCard);
                    
                    projectCard.querySelector('.project-accordion-header').addEventListener('click', (e) => { 
                        if(!e.target.closest('button')) { 
                            activeProject = project;
                            activeProjectDisplay.innerHTML = `<span class="font-normal mr-2">${currentTranslations['active_project'] || 'Active Project:'}</span> <strong>${project.name}</strong>`;
                            const content = projectCard.querySelector('.project-accordion-content');
                            const arrow = projectCard.querySelector('.accordion-arrow');
                            content.classList.toggle('open');
                            arrow.classList.toggle('open');
                            if(content.classList.contains('open') && !content.dataset.loaded) { loadProjectDetails(project.id); } 
                        }
                    });
                    projectCard.querySelector('.edit-project-btn').addEventListener('click', () => editProject(project));
                    projectCard.querySelector('.delete-project-btn').addEventListener('click', () => deleteProject(project.id));
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
            const scrapBtn = e.target.closest('.hs-scrap-contact-btn');
            if (scrapBtn) { 
                document.getElementById('hs-url-input').value = scrapBtn.dataset.url; 
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
                link.href = URL.createObjectURL(blob);
                link.download = 'exported_project_media.txt';
                link.click();
                URL.revokeObjectURL(link.href);
            }
        });

        projectForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = projectNameInput.value;
            const url = normalizeUrl(projectUrlInput.value);
            const keywords = projectKeywordsState;
            const editingId = projectIdInput.value;
            
            const projectData = { name, url, keywords };

            let error;
            if (editingId) {
                const { error: updateError } = await sb.from('projects').update(projectData).eq('id', editingId);
                error = updateError;
            } else {
                projectData.user_id = user.id;
                const { error: insertError } = await sb.from('projects').insert(projectData);
                error = insertError;
            }

            if (error) { alert('Error saving project: ' + error.message); }
            else {
                showProjectForm(false);
                await loadProjects(user);
            }
        });
        
        // =================================================================================
        // 🛠️ HYBRID SCRAPER LOGIC
        // =================================================================================
        const hs_urlInput = document.getElementById('hs-url-input');
        const hs_scrapeBtn = document.getElementById('hs-scrape-btn');
        const hs_resultsContainer = document.getElementById('hs-results-container');
        const hs_logContainerWrapper = document.getElementById('hs-log-container-wrapper');
        const hs_logContainer = document.getElementById('hs-log-container');

        const hs_showError = (message) => { hs_logContainer.innerHTML += `<p class="text-red-400">[ERROR] ${message}</p>`; };
        const hs_log = (message) => { hs_logContainer.innerHTML += `<p class="text-slate-300">${message}</p>`; hs_logContainer.scrollTop = hs_logContainer.scrollHeight; };
        
        const hs_createResultCard = (text, linkUrl, type) => {
            const icons = {
                email: `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>`,
                linkedin: `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5V8h3v11zM6.5 6.73c-.966 0-1.75-.79-1.75-1.76S5.75 3.21 6.5 3.21s1.75.79 1.75 1.76S7.466 6.73 6.5 6.73zM19 19h-3v-5.6c0-1.33-.027-3.03-1.85-3.03-1.85 0-2.136 1.44-2.136 2.93V19h-3V8h2.88v1.32h.04c.4-.76 1.37-1.55 2.84-1.55 3.04 0 3.6 2 3.6 4.6V19z"/></svg>`,
                default: `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>`
            };
            const card = document.createElement('div');
            card.className = 'bg-white p-4 rounded-lg shadow-sm border flex items-center gap-4';
            card.innerHTML = `
                <div class="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-sky-100 text-sky-600">${icons[type] || icons.default}</div>
                <div class="flex-grow overflow-hidden">
                    <a href="${linkUrl}" target="_blank" rel="noopener noreferrer" class="font-semibold truncate block text-slate-700 hover:text-sky-600" title="${text}">${text}</a>
                </div>
                <button class="copy-btn ml-auto bg-slate-200 text-slate-700 text-sm font-semibold py-2 px-3 rounded-md hover:bg-slate-300 transition-colors flex-shrink-0">Copy</button>
            `;
            card.querySelector('.copy-btn').addEventListener('click', () => navigator.clipboard.writeText(text));
            return card;
        };
        
        const hs_renderResults = (emails, socials) => {
            hs_resultsContainer.innerHTML = '';
            let resultsFound = false;

            if (emails.length > 0) {
                resultsFound = true;
                const container = document.createElement('div');
                container.innerHTML = `<h3 class="text-xl font-semibold mb-3">Found Emails</h3>`;
                const grid = document.createElement('div');
                grid.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';
                emails.forEach(email => grid.appendChild(hs_createResultCard(email, `mailto:${email}`, 'email')));
                container.appendChild(grid);
                hs_resultsContainer.appendChild(container);
            }
            if (socials.length > 0) {
                resultsFound = true;
                const container = document.createElement('div');
                container.innerHTML = `<h3 class="text-xl font-semibold mt-6 mb-3">Found Social & Contact Links</h3>`;
                const grid = document.createElement('div');
                grid.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';
                socials.forEach(link => grid.appendChild(hs_createResultCard(link, link, new URL(link).hostname.includes('linkedin') ? 'linkedin' : 'default')));
                container.appendChild(grid);
                hs_resultsContainer.appendChild(container);
            }

            if (!resultsFound) {
                hs_resultsContainer.innerHTML = `<div class="bg-white p-6 rounded-lg text-center text-slate-600"><p>The search has finished, but no contact information was found.</p></div>`;
            }
        };

        const hs_scrape = async () => {
            const urlToScrape = normalizeUrl(hs_urlInput.value);
            if (!urlToScrape) return;

            hs_scrapeBtn.disabled = true;
            hs_scrapeBtn.innerHTML = '<div class="loader w-6 h-6 border-4 mx-auto"></div>';
            hs_resultsContainer.innerHTML = '';
            hs_logContainer.innerHTML = '';
            hs_logContainerWrapper.classList.remove('hidden');

            try {
                hs_log(`[INFO] Starting scrape for: ${urlToScrape}`);
                let response = await fetch(`/.netlify/functions/scrape?url=${encodeURIComponent(urlToScrape)}`);
                if (!response.ok) throw new Error(`Scraping failed with status ${response.status}`);
                let html = await response.text();

                let emails = html.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi) || [];
                let socials = html.match(/https?:\/\/(www\.)?(linkedin\.com|twitter\.com|facebook\.com|instagram\.com)\/[a-zA-Z0-9._\/-]+/gi) || [];
                emails = [...new Set(emails.filter(e => !e.endsWith('.png') && !e.endsWith('.jpg')))];
                socials = [...new Set(socials)];

                hs_log(`[INFO] Initial scan found ${emails.length} emails and ${socials.length} social links.`);
                hs_renderResults(emails, socials);

                if (emails.length === 0) {
                    hs_log(`[WARN] No emails found. Starting Deep Scan...`);
                    const links = Array.from(new Set(html.match(/href="([^"]+)"/g)
                        .map(match => match.slice(6, -1))
                        .map(link => new URL(link, urlToScrape).href)
                        .filter(link => new URL(link).hostname === new URL(urlToScrape).hostname)
                    ));
                    
                    hs_log(`[INFO] Found ${links.length} internal links. Asking Gemini to select contact pages...`);
                    const triageResponse = await fetch(`/.netlify/functions/triage-links`, { method: 'POST', body: JSON.stringify({ urls: links }) });
                    const { selectedUrls } = await triageResponse.json();
                    
                    if (selectedUrls && selectedUrls.length > 0) {
                        hs_log(`[SUCCESS] Gemini suggested: ${selectedUrls.join(', ')}`);
                        for (const contactUrl of selectedUrls) {
                            hs_log(`[INFO] Deep scraping: ${contactUrl}`);
                            response = await fetch(`/.netlify/functions/scrape?url=${encodeURIComponent(contactUrl)}`);
                            html = await response.text();
                            const deepEmails = html.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi) || [];
                            emails.push(...deepEmails);
                        }
                        emails = [...new Set(emails.filter(e => !e.endsWith('.png') && !e.endsWith('.jpg')))];
                        hs_renderResults(emails, socials);
                    } else {
                        hs_log(`[INFO] Gemini didn't suggest any specific contact pages to scrape.`);
                    }
                }

                if (emails.length === 0) {
                    hs_log(`[WARN] Still no emails. Asking Gemini for a guess...`);
                    const domain = new URL(urlToScrape).hostname;
                    const guessResponse = await fetch(`/.netlify/functions/ask-gemini?domain=${domain}`);
                    const { email } = await guessResponse.json();
                    if(email) {
                        hs_log(`[SUCCESS] Gemini suggested contact email: ${email}`);
                        emails.push(email);
                    } else {
                        hs_log(`[INFO] Gemini could not guess an email.`);
                    }
                    hs_renderResults(emails, socials);
                }

            } catch (e) {
                hs_showError(e.message);
            } finally {
                hs_scrapeBtn.disabled = false;
                hs_scrapeBtn.textContent = currentTranslations['hybrid_search_btn'] || 'Search';
            }
        };
        hs_scrapeBtn.addEventListener('click', hs_scrape);


        // =================================================================================
        // 💜 AFFINITY OUTREACH LOGIC
        // =================================================================================
        const ao_keywordInput = document.getElementById('ao-keyword-input');
        const ao_addKeywordBtn = document.getElementById('ao-add-keyword-btn');
        const ao_clearKeywordsBtn = document.getElementById('ao-clear-keywords-btn');
        const ao_tagsContainer = document.getElementById('ao-tags-container');
        const ao_searchMediaBtn = document.getElementById('ao-search-media-btn');
        const ao_resultsContainer = document.getElementById('ao-results-container');
        const ao_logContainerWrapper = document.getElementById('ao-log-container-wrapper');
        const ao_logContainer = document.getElementById('ao-log-container');
        const ao_searchTypeSelect = document.getElementById('ao-search-type');
        const ao_countrySelect = document.getElementById('ao-country');
        const ao_languageSelect = document.getElementById('ao-language');

        const ao_renderTags = () => {
            ao_tagsContainer.innerHTML = '';
            ao_keywords.forEach(keyword => {
                const tag = document.createElement('div'); tag.className = 'tag'; tag.textContent = keyword;
                const removeBtn = document.createElement('button'); removeBtn.className = 'tag-remove'; removeBtn.innerHTML = '&times;';
                removeBtn.onclick = () => { ao_keywords = ao_keywords.filter(k => k !== keyword); ao_renderTags(); };
                tag.appendChild(removeBtn); ao_tagsContainer.appendChild(tag);
            });
        };
        const ao_addKeyword = () => {
            const newKeyword = ao_keywordInput.value.trim();
            if (newKeyword && !ao_keywords.includes(newKeyword)) {
                ao_keywords.push(newKeyword); ao_renderTags();
            }
            ao_keywordInput.value = '';
        };

        const ao_loadProjectKeywords = () => {
            if(activeProject && activeProject.keywords && activeProject.keywords.length > 0) {
                ao_keywords = [...new Set([...ao_keywords, ...activeProject.keywords])];
                ao_renderTags();
            }
        };

        ao_keywordInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ao_addKeyword(); }});
        ao_addKeywordBtn.addEventListener('click', ao_addKeyword);
        ao_clearKeywordsBtn.addEventListener('click', () => { ao_keywords = []; ao_renderTags(); });

        const ao_populateSelects = () => {
            const searchTypes = {'Top Authority': 'top_authority', 'Established': 'established', 'Rising Stars': 'rising_stars'};
            const countries = {'USA': 'us', 'UK': 'uk', 'Spain': 'es', 'Mexico': 'mx', 'Argentina': 'ar'};
            const languages = {'English': 'en', 'Spanish': 'es'};
            Object.entries(searchTypes).forEach(([name, code]) => ao_searchTypeSelect.add(new Option(name, code)));
            Object.entries(countries).forEach(([name, code]) => ao_countrySelect.add(new Option(name, code)));
            Object.entries(languages).forEach(([name, code]) => ao_languageSelect.add(new Option(name, code)));
        };
        ao_populateSelects();

        const ao_log = (msg) => { ao_logContainer.innerHTML += msg.replace(/\[/g, '<span class="text-cyan-400">[')
                                        .replace(/\]/g, ']</span>')
                                        .replace(/SUCCESS/g, '<span class="text-green-400">SUCCESS</span>')
                                        .replace(/WARN/g, '<span class="text-yellow-400">WARN</span>')
                                        .replace(/FATAL/g, '<span class="text-red-400">FATAL</span>') + '<br>'; 
                                ao_logContainer.scrollTop = ao_logContainer.scrollHeight; };
        
        const ao_saveToProject = async (media) => {
            if (!activeProject) { alert(currentTranslations['select_project_alert']); return false; }
            const { data, error } = await sb.from('saved_media').insert({
                project_id: activeProject.id,
                user_id: user.id,
                name: media.name,
                url: media.url,
                description: media.description,
                reason: media.reason,
                relevance_score: media.relevanceScore,
                category: media.category,
            });
            if(error) { alert('Error saving media: ' + error.message); return false; }
            return true;
        };

        const ao_renderResults = (results) => {
            ao_resultsContainer.innerHTML = results.map((res, index) => `
                <div class="bg-white p-4 rounded-xl shadow-sm border mb-4">
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="font-bold text-lg text-slate-800">${res.name}</h4>
                            <a href="${res.url}" target="_blank" rel="noopener noreferrer" class="text-sm text-sky-600">${res.url}</a>
                        </div>
                        <div class="flex-shrink-0 ml-4">
                            <span class="category-tag bg-slate-200 text-slate-600">${res.category}</span>
                            <span class="ml-2 font-bold text-slate-700">${res.relevanceScore}/10</span>
                        </div>
                    </div>
                    <p class="text-sm text-slate-600 mt-2"><strong>Description:</strong> ${res.description}</p>
                    <p class="text-sm text-slate-600 mt-1"><strong>Reason:</strong> ${res.reason}</p>
                    <button class="ao-save-btn mt-3 bg-green-100 text-green-700 text-xs font-bold py-1 px-3 rounded-lg" data-result-index="${index}">${currentTranslations['save_to_project_btn'] || 'Save to Project'}</button>
                </div>
            `).join('');

            document.querySelectorAll('.ao-save-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const button = e.currentTarget;
                    const result = ao_currentResults[button.dataset.resultIndex];
                    button.disabled = true;
                    const success = await ao_saveToProject(result);
                    if(success) {
                        button.textContent = currentTranslations['media_saved'] || 'Saved ✔️';
                        button.classList.remove('bg-green-100', 'text-green-700');
                        button.classList.add('bg-slate-200', 'text-slate-500');
                    } else {
                        button.disabled = false;
                    }
                });
            });
        };

        ao_searchMediaBtn.addEventListener('click', async () => {
            if (ao_keywords.length === 0) { alert('Please add at least one keyword.'); return; }
            ao_searchMediaBtn.disabled = true;
            ao_searchMediaBtn.innerHTML = '<div class="loader w-6 h-6 border-4 mx-auto"></div>';
            ao_logContainerWrapper.classList.remove('hidden');
            ao_logContainer.innerHTML = '';
            ao_resultsContainer.innerHTML = '';
            ao_currentResults = [];

            const country = ao_countrySelect.value;
            const language = ao_languageSelect.value;
            const searchType = ao_searchTypeSelect.value;
            
            const promises = ao_keywords.map(kw => fetch(`/.netlify/functions/affinity-search?keyword=${encodeURIComponent(kw)}&country=${country}&language=${language}&searchType=${searchType}`).then(res => {
                if (!res.headers.get('content-type')?.includes('application/json')) {
                    return res.text().then(text => { throw new Error(`Server returned non-JSON response: ${text}`); });
                }
                return res.json();
            }));

            for (const promise of promises) {
                try {
                    const result = await promise;
                    if (result.log) result.log.forEach(ao_log);
                    if (result.error) {
                        ao_log(`[WARN] Search for a keyword failed: ${result.error}`);
                        continue;
                    };
                    ao_currentResults.push(...result.directResults);
                } catch(e) { ao_log(`[FATAL] A keyword search failed completely. ${e.message}`); }
            }
            
            ao_currentResults.sort((a,b) => b.relevanceScore - a.relevanceScore);
            ao_renderResults(ao_currentResults);

            ao_searchMediaBtn.disabled = false;
            ao_searchMediaBtn.innerHTML = currentTranslations['search_media_btn'] || 'Search Media';
        });

        await loadProjects(user);
    };

    // =================================================================================
    // 🔒 AUTHENTICATION CONTROLLER
    // =================================================================================
    sb.auth.onAuthStateChange(async (event, session) => {
        const user = session?.user;
        if (session) {
            body.classList.remove('logged-out');
            body.classList.add('logged-in');
            
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
        if (error) { showAuthMessage(error.message); }
        else { showAuthMessage('Sign up successful! Please check your email.', 'success'); }
    });

    authLanguageSelect.addEventListener('change', (e) => translatePage(e.target.value));
});
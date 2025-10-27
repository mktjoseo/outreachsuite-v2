// Final, corrected, and fully functional app.js file.
document.addEventListener('DOMContentLoaded', () => {
    // =================================================================================
    // 🚀 INITIALIZATION & GLOBAL STATE
    // =================================================================================
    const { createClient } = supabase;
    const SUPABASE_URL = 'https://xdrzsunisujjrghjntnn.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkcnpzdW5pc3VqanJnaGpudG5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyNjYyODcsImV4cCI6MjA2ODg0MjI4N30.jAZA8q2niY7MTO7jolyKAPiFcRVmKu2-ObSrCoXfhGk';
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            storage: window.localStorage,
        },
    });

    // App-wide state
    let currentTranslations = {};
    let isAppInitialized = false;
    let activeProject = null;
    let ao_keywords = [];
    let consoleInterval = null;
    let extractedTextState = null;

    // Global DOM references
    const body = document.body;
    const userProfileContainer = document.getElementById('user-profile-container');
    const activeProjectDisplay = document.getElementById('active-project-display');
    
    // Global object for functions that need to be accessed from different modules
    window.outreachSuite = {};


    // =================================================================================
    // 🛠️ UTILITY & GLOBAL UI FUNCTIONS
    // =================================================================================

    const logToConsole = (container, message) => {
        if (!container) return;
        const formatted = message.replace(/\[/g, '<span class="text-cyan-400">[').replace(/\]/g, ']</span>')
                               .replace(/SUCCESS/g, '<span class="text-green-400">SUCCESS</span>')
                               .replace(/WARN/g, '<span class="text-yellow-400">WARN</span>')
                               .replace(/FATAL/g, '<span class="text-red-400">FATAL</span>');
        container.innerHTML += `<p>${formatted}</p>`;
        container.scrollTop = container.scrollHeight;
    };

    const normalizeUrl = (url) => {
        let n = url ? url.trim() : '';
        if (!/^(https?:\/\/)/i.test(n) && n) {
            n = 'https://' + n;
        }
        return n;
    };

    function setupPasswordToggle(toggleButtonId, passwordInputId, openEyeId, closedEyeId) {
    const toggleButton = document.getElementById(toggleButtonId);
    const passwordInput = document.getElementById(passwordInputId);
    const eyeOpen = document.getElementById(openEyeId);
    const eyeClosed = document.getElementById(closedEyeId);
    if (toggleButton && passwordInput && eyeOpen && eyeClosed) {
        toggleButton.addEventListener('click', () => {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';
            eyeOpen.classList.toggle('hidden', isPassword);
            eyeClosed.classList.toggle('hidden', !isPassword);
        });
       }
      }
    const translatePage = async (lang) => {
        try {
            const response = await fetch(`./lang/${lang}.json`);
            if (!response.ok) {
                console.error(`Failed to load translation file: ${lang}.json`);
                return;
            };
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
            const tooltip = document.getElementById('ao-search-type-tooltip');
            if(tooltip) tooltip.innerHTML = translations['search_type_tooltip_content'] || '';
            const langEnBtn = document.getElementById('lang-en');
            const langEsBtn = document.getElementById('lang-es');
            if (langEnBtn && langEsBtn) {
                langEnBtn.classList.toggle('bg-white', lang === 'en');
                langEnBtn.classList.toggle('text-slate-800', lang === 'en');
                langEsBtn.classList.toggle('bg-white', lang === 'es');
                langEsBtn.classList.toggle('text-slate-800', lang === 'es');
            }
        } catch (e) { console.error("Translation Error:", e); }
    };

    const showAuthMessage = (message, type = 'error') => {
        const errorDiv = document.getElementById('auth-error');
        const successDiv = document.getElementById('auth-success');
        errorDiv.classList.add('hidden');
        successDiv.classList.add('hidden');
        
        const targetDiv = type === 'error' ? errorDiv : successDiv;
        targetDiv.textContent = message;
        targetDiv.classList.remove('hidden');
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
    // ⚙️ SETTINGS VIEW LOGIC
    // =================================================================================
    function setupSettingsLogic(user) {
        const userFirstNameInput = document.getElementById('user-first-name');
        const userLastNameInput = document.getElementById('user-last-name');
        const saveSettingsBtn = document.getElementById('save-settings-btn');
        const settingsSuccessDiv = document.getElementById('settings-success');
        const newPasswordInput = document.getElementById('new-password');
        const confirmNewPasswordInput = document.getElementById('confirm-new-password');
        const updatePasswordBtn = document.getElementById('update-password-btn');
        const passwordSuccessDiv = document.getElementById('password-update-success');
        const passwordErrorDiv = document.getElementById('password-update-error');

        userFirstNameInput.value = user.user_metadata?.first_name || '';
        userLastNameInput.value = user.user_metadata?.last_name || '';

        saveSettingsBtn.addEventListener('click', async () => {
            settingsSuccessDiv.classList.add('hidden');
            const { data, error } = await sb.auth.updateUser({ 
                data: { 
                    first_name: userFirstNameInput.value, 
                    last_name: userLastNameInput.value 
                } 
            });
            if (error) {
                alert('Error: ' + error.message);
            } else {
                updateUserAvatar(data.user);
                settingsSuccessDiv.textContent = currentTranslations['settings_saved_success'];
                settingsSuccessDiv.classList.remove('hidden');
                setTimeout(() => settingsSuccessDiv.classList.add('hidden'), 3000);
            }
        });

        updatePasswordBtn.addEventListener('click', async () => {
            passwordSuccessDiv.classList.add('hidden');
            passwordErrorDiv.classList.add('hidden');
            const newPassword = newPasswordInput.value;
            const confirmPassword = confirmNewPasswordInput.value;

            if (!newPassword || newPassword.length < 6) {
                passwordErrorDiv.textContent = "Password must be at least 6 characters long.";
                passwordErrorDiv.classList.remove('hidden');
                return;
            }
            if (newPassword !== confirmPassword) {
                passwordErrorDiv.textContent = currentTranslations['password_mismatch_error'] || "Passwords do not match.";
                passwordErrorDiv.classList.remove('hidden');
                return;
            }

            const { error } = await sb.auth.updateUser({ password: newPassword });
            if (error) {
                passwordErrorDiv.textContent = error.message;
                passwordErrorDiv.classList.remove('hidden');
            } else {
                passwordSuccessDiv.textContent = currentTranslations['password_updated_success'] || "Password updated successfully!";
                passwordSuccessDiv.classList.remove('hidden');
                newPasswordInput.value = '';
                confirmNewPasswordInput.value = '';
                setTimeout(() => passwordSuccessDiv.classList.add('hidden'), 3000);
            }
        });
    }

    // =================================================================================
    // 📝 PROJECTS VIEW LOGIC
    // =================================================================================
    function setupProjectsLogic(user) {
        const projectForm = document.getElementById('project-form');
        const projectFormTitle = document.getElementById('project-form-title');
        const projectIdInput = document.getElementById('project-id-input');
        const projectNameInput = document.getElementById('project-name');
        const projectUrlInput = document.getElementById('project-url');
        const projectKeywordInput = document.getElementById('project-keyword-input');
        const projectAddKeywordBtn = document.getElementById('project-add-keyword-btn');
        const projectTagsContainer = document.getElementById('project-tags-container');
        const projectCancelBtn = document.getElementById('project-cancel-btn');
        const addProjectBtn = document.getElementById('add-project-btn');
        const createEditProjectContainer = document.getElementById('create-edit-project-container');
        const projectsListView = document.getElementById('projects-list-view');
        const projectsListContainer = document.getElementById('projects-list-container');
        const fetchContentBtn = document.getElementById('project-fetch-content-btn');
        const analyzeTextBtn = document.getElementById('project-analyze-text-btn');
        const renderJsCheckbox = document.getElementById('project-render-js-checkbox');
        const step1Div = document.getElementById('keyword-generator-step-1');
        const step2Div = document.getElementById('keyword-generator-step-2');
        const fetchSuccessMsg = document.getElementById('fetch-success-msg');
        const projectKeywordLogContainerWrapper = document.getElementById('project-keyword-log-container-wrapper');
        const projectKeywordLogContainer = document.getElementById('project-keyword-log-container');

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

        const addProjectKeyword = () => {
            const newKeyword = projectKeywordInput.value.trim();
            if (newKeyword && !projectKeywordsState.includes(newKeyword)) {
                projectKeywordsState.push(newKeyword);
                renderProjectTags();
            }
            projectKeywordInput.value = '';
        };

        const showProjectForm = (show = true) => {
            createEditProjectContainer.classList.toggle('hidden', !show);
            projectsListView.classList.toggle('hidden', show);
            if (show) resetProjectForm();
        };

        const resetProjectForm = () => {
            projectForm.reset();
            projectIdInput.value = '';
            projectKeywordsState = [];
            renderProjectTags();
            projectFormTitle.textContent = currentTranslations['create_edit_title_create'] || "Create a New Project";
            step1Div.classList.remove('hidden');
            step2Div.classList.add('hidden');
            extractedTextState = null;
            projectKeywordLogContainerWrapper.classList.add('hidden');
        };
        
        const editProject = (project) => {
            showProjectForm(true);
            projectFormTitle.textContent = `${currentTranslations['create_edit_title_edit'] || "Editing Project"}: ${project.name}`;
            projectIdInput.value = project.id;
            projectNameInput.value = project.name;
            projectUrlInput.value = project.url;
            projectKeywordsState = [...(project.keywords || [])];
            renderProjectTags();
        };

        window.outreachSuite.editProjectCallback = editProject;

        projectKeywordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addProjectKeyword(); } });
        projectAddKeywordBtn.addEventListener('click', addProjectKeyword);
        addProjectBtn.addEventListener('click', () => showProjectForm(true));
        projectCancelBtn.addEventListener('click', () => showProjectForm(false));

        fetchContentBtn.addEventListener('click', async () => {
            const url = normalizeUrl(projectUrlInput.value);
            if (!url) { alert('Please enter a project URL to analyze.'); return; }
            projectKeywordLogContainerWrapper.classList.remove('hidden');
            projectKeywordLogContainer.innerHTML = '';
            fetchContentBtn.disabled = true;
            fetchContentBtn.innerHTML = `<div class="loader mx-auto"></div>`;
            try {
                logToConsole(projectKeywordLogContainer, '[INFO] Fetching content from URL...');
                const response = await fetch('/.netlify/functions/fetch-content', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectUrl: url, render: renderJsCheckbox.checked })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Failed to fetch content.');
                extractedTextState = data.textContent;
                logToConsole(projectKeywordLogContainer, `[SUCCESS] Content extracted successfully (${data.characters} characters). Ready to analyze.`);
                step1Div.classList.add('hidden');
                step2Div.classList.remove('hidden');
                fetchSuccessMsg.textContent = `Content extracted (${data.characters} chars). Ready for AI analysis.`;
            } catch (e) {
                logToConsole(projectKeywordLogContainer, `[FATAL] ${e.message}`);
                step1Div.classList.remove('hidden');
                step2Div.classList.add('hidden');
            } finally {
                fetchContentBtn.disabled = false;
                fetchContentBtn.innerHTML = currentTranslations['fetch_content_btn'] || 'Fetch Content';
            }
        });

        analyzeTextBtn.addEventListener('click', async () => {
            if (!extractedTextState) { alert('No content to analyze.'); return; }
            analyzeTextBtn.disabled = true;
            analyzeTextBtn.innerHTML = `<div class="loader mx-auto"></div>`;
            try {
                logToConsole(projectKeywordLogContainer, '[INFO] Sending content to Gemini for analysis...');
                const response = await fetch('/.netlify/functions/analyze-text', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ textContent: extractedTextState, domain: new URL(normalizeUrl(projectUrlInput.value)).hostname })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Failed to analyze text.');
                logToConsole(projectKeywordLogContainer, `[SUCCESS] Gemini analysis complete!`);
                const combined = [...new Set([...projectKeywordsState, ...data.existingKeywords, ...data.opportunityKeywords])];
                projectKeywordsState = combined;
                renderProjectTags();
                step1Div.classList.remove('hidden');
                step2Div.classList.add('hidden');
            } catch (e) {
                logToConsole(projectKeywordLogContainer, `[FATAL] ${e.message}`);
            } finally {
                analyzeTextBtn.disabled = false;
                analyzeTextBtn.innerHTML = currentTranslations['analyze_text_btn'] || 'Analyze Text with AI';
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
                await window.outreachSuite.loadProjects(user);
            }
        });
        
        projectsListContainer.addEventListener('click', (e) => {
            const scrapBtn = e.target.closest('.hs-scrap-contact-btn');
            if (scrapBtn) {
                document.getElementById('hs-url-input').value = scrapBtn.dataset.url;
                window.location.hash = 'hybrid-scraper';
            }
        });
    }

    // =================================================================================
    // 🛠️ HYBRID SCRAPER VIEW LOGIC
    // =================================================================================
    function setupHybridScraperLogic(user) {
        const hs_urlInput = document.getElementById('hs-url-input');
        const hs_scrapeBtn = document.getElementById('hs-scrape-btn');
        const hs_languageSelect = document.getElementById('hs-language-select');
        const hs_resultsContainer = document.getElementById('hs-results-container');
        const hs_logContainerWrapper = document.getElementById('hs-log-container-wrapper');
        const hs_logContainer = document.getElementById('hs-log-container');
        const hs_promptContainer = document.getElementById('hs-prompt-container');
        const hs_promptMessage = document.getElementById('hs-prompt-message');
        const hs_promptLinks = document.getElementById('hs-prompt-links');
        const hs_deepScanBtn = document.getElementById('hs-deep-scan-btn');

        const scraperLanguages = {'English': 'en', 'Spanish': 'es', 'Polish': 'pl', 'Italian': 'it', 'German': 'de', 'French': 'fr'};
        Object.entries(scraperLanguages).forEach(([name, code]) => hs_languageSelect.add(new Option(name, code)));
        hs_languageSelect.value = user.user_metadata?.language || 'en';

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
            const copyBtn = card.querySelector('.copy-btn');
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(text);
                copyBtn.textContent = 'Copied!';
                setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
            });
            return card;
        };

        const hs_renderResults = (emails, socials) => {
            hs_resultsContainer.innerHTML = '';
            let resultsFound = false;
            if (emails.length > 0) {
                resultsFound = true;
                const container = document.createElement('div');
                container.innerHTML = `<h3 class="text-xl font-semibold mb-3">Found Emails</h3>`;
                const grid = document.createElement('div'); grid.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';
                emails.forEach(email => grid.appendChild(hs_createResultCard(email, `mailto:${email}`, 'email')));
                container.appendChild(grid); hs_resultsContainer.appendChild(container);
            }
            if (socials.length > 0) {
                resultsFound = true;
                const container = document.createElement('div');
                container.innerHTML = `<h3 class="text-xl font-semibold mt-6 mb-3">Found Social & Contact Links</h3>`;
                const grid = document.createElement('div'); grid.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';
                socials.forEach(link => grid.appendChild(hs_createResultCard(link, link, new URL(link).hostname.includes('linkedin') ? 'linkedin' : 'default')));
                container.appendChild(grid); hs_resultsContainer.appendChild(container);
            }
            if (!resultsFound) {
                hs_resultsContainer.innerHTML = `<div class="bg-white p-6 rounded-lg text-center text-slate-600"><p>The initial scan found no contact information.</p></div>`;
            }
        };

        const hs_executeDeepScan = async (contactUrls, emails, socials) => {
            hs_promptContainer.classList.add('hidden');
            logToConsole(hs_logContainer, `[INFO] Executing Deep Scan on ${contactUrls.length} URLs...`);
            for (const contactUrl of contactUrls) {
                logToConsole(hs_logContainer, `[INFO] Deep scraping: ${contactUrl}`);
                try {
                    const response = await fetch(`/.netlify/functions/scrape?url=${encodeURIComponent(contactUrl)}`);
                    const html = await response.text();
                    const deepEmails = html.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi) || [];
                    emails.push(...deepEmails);
                } catch (e) {
                    logToConsole(hs_logContainer, `[WARN] Failed to scrape ${contactUrl}: ${e.message}`);
                }
            }
            emails = [...new Set(emails.filter(e => !e.endsWith('.png') && !e.endsWith('.jpg')))];
            logToConsole(hs_logContainer, `[SUCCESS] Deep Scan finished. Total unique emails found: ${emails.length}. Search complete! ✅`);
            hs_renderResults(emails, socials);
        };

        const hs_scrape = async () => {
            const urlToScrape = normalizeUrl(hs_urlInput.value);
            if (!urlToScrape) return;
            hs_scrapeBtn.disabled = true;
            hs_scrapeBtn.innerHTML = '<div class="loader"></div>';
            hs_resultsContainer.innerHTML = '';
            hs_logContainer.innerHTML = '';
            hs_logContainerWrapper.classList.remove('hidden');
            hs_promptContainer.classList.add('hidden');
            try {
                logToConsole(hs_logContainer, `[INFO] Starting scrape for: ${urlToScrape}`);
                let response = await fetch(`/.netlify/functions/scrape?url=${encodeURIComponent(urlToScrape)}`);
                if (!response.ok) throw new Error(`Scraping failed with status ${response.status}`);
                let html = await response.text();
                let emails = html.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi) || [];
                let socials = html.match(/https?:\/\/(www\.)?(linkedin\.com|twitter\.com|facebook\.com|instagram\.com)\/[a-zA-Z0-9._\/-]+/gi) || [];
                emails = [...new Set(emails.filter(e => !e.endsWith('.png') && !e.endsWith('.jpg')))];
                socials = [...new Set(socials)];
                logToConsole(hs_logContainer, `[SUCCESS] Initial scan found ${emails.length} emails and ${socials.length} social links.`);
                if (emails.length > 0 || socials.length > 0) hs_renderResults(emails, socials);
                if (emails.length === 0) {
                    logToConsole(hs_logContainer, `[WARN] No emails found on homepage. Looking for contact pages...`);
                    const links = Array.from(new Set(html.match(/href="([^"]+)"/g)
                        ?.map(match => match.slice(6, -1)).map(link => { try { return new URL(link, urlToScrape).href; } catch (e) { return null; } })
                        .filter(link => link && new URL(link).hostname === new URL(urlToScrape).hostname) ?? []
                    ));
                    logToConsole(hs_logContainer, `[INFO] Found ${links.length} internal links. Asking Gemini to select contact pages...`);
                    const triageResponse = await fetch(`/.netlify/functions/triage-links`, {
                        method: 'POST', 
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ urls: links, language: hs_languageSelect.value })
                    });
                    const { selectedUrls, error } = await triageResponse.json();
                    if (error) throw new Error(`AI Triage Error: ${error}`);
                    if (selectedUrls && selectedUrls.length > 0) {
                        logToConsole(hs_logContainer, `[SUCCESS] Gemini suggested: ${selectedUrls.join(', ')}`);
                        hs_promptMessage.textContent = 'Deep Scan Recommended on these pages:';
                        hs_promptLinks.innerHTML = selectedUrls.map(url => `<p class="text-slate-300">${url}</p>`).join('');
                        hs_promptContainer.classList.remove('hidden');
                        hs_deepScanBtn.onclick = () => hs_executeDeepScan(selectedUrls, emails, socials);
                    } else {
                        logToConsole(hs_logContainer, `[SUCCESS] Gemini didn't find specific contact pages. Search complete! ✅`);
                        if (socials.length > 0) hs_renderResults(emails, socials); else hs_renderResults([], []);
                    }
                } else {
                    logToConsole(hs_logContainer, `[SUCCESS] Search complete! ✅`);
                }
            } catch (e) {
                logToConsole(hs_logContainer, `[FATAL] ${e.message}`);
            } finally {
                hs_scrapeBtn.disabled = false;
                hs_scrapeBtn.textContent = currentTranslations['hybrid_search_btn'] || 'Search';
            }
        };

        hs_scrapeBtn.addEventListener('click', hs_scrape);
    }

    // =================================================================================
    // 💜 AFFINITY OUTREACH VIEW LOGIC
    // =================================================================================
    function setupAffinityOutreachLogic(user) {
        const ao_keywordInput = document.getElementById('ao-keyword-input');
        const ao_addKeywordBtn = document.getElementById('ao-add-keyword-btn');
        const ao_clearKeywordsBtn = document.getElementById('ao-clear-keywords-btn');
        const ao_tagsContainer = document.getElementById('ao-tags-container');
        const ao_searchMediaBtn = document.getElementById('ao-search-media-btn');
        const ao_resultsHeader = document.getElementById('ao-results-header');
        const ao_resultsContainer = document.getElementById('ao-results-container');
        const ao_logContainerWrapper = document.getElementById('ao-log-container-wrapper');
        const ao_logContainer = document.getElementById('ao-log-container');
        const ao_searchTypeSelect = document.getElementById('ao-search-type');
        const ao_countrySelect = document.getElementById('ao-country');
        const ao_languageSelect = document.getElementById('ao-language');

        let ao_currentResults = [];

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

        window.outreachSuite.ao_loadProjectKeywords = () => {
            ao_keywords = (activeProject?.keywords?.length > 0) ? [...new Set(activeProject.keywords)] : [];
            ao_renderTags();
        };

        const ao_populateSelects = () => {
            ao_searchTypeSelect.innerHTML = ''; 
            ao_countrySelect.innerHTML = ''; 
            ao_languageSelect.innerHTML = '';
            
            const searchTypes = {
                'search_type_top_authority': 'top_authority', 
                'search_type_established': 'established', 
                'search_type_rising_stars': 'rising_stars'
            };
            const countries = {'USA': 'us', 'UK': 'uk', 'Spain': 'es', 'Mexico': 'mx', 'Argentina': 'ar', 'Colombia': 'co', 'Chile': 'cl', 'Peru': 'pe', 'Germany': 'de', 'France': 'fr', 'Italy': 'it', 'Poland': 'pl' };
            const languages = {'English': 'en', 'Spanish': 'es', 'German': 'de', 'French': 'fr', 'Italian': 'it', 'Polish': 'pl'};
            
            Object.entries(searchTypes).forEach(([key, value]) => {
                const translatedName = currentTranslations[key] || key.replace('search_type_', '').replace(/_/g, ' ');
                ao_searchTypeSelect.add(new Option(translatedName, value));
            });
            Object.entries(countries).forEach(([name, code]) => ao_countrySelect.add(new Option(name, code)));
            Object.entries(languages).forEach(([name, code]) => ao_languageSelect.add(new Option(name, code)));
        };
        // This makes the dropdowns re-translate when the language changes
        document.body.addEventListener('languageChanged', ao_populateSelects);


        const startConsoleAnimation = () => {
            if (consoleInterval) clearInterval(consoleInterval);
            let dots = '';
            const thinkingElement = document.createElement('p');
            thinkingElement.id = 'thinking-animation';
            ao_logContainer.appendChild(thinkingElement);
            consoleInterval = setInterval(() => {
                dots = dots.length < 3 ? dots + '.' : '';
                thinkingElement.innerHTML = `<span class="text-cyan-400">[INFO]</span> Working ${dots}`;
                ao_logContainer.scrollTop = ao_logContainer.scrollHeight;
            }, 500);
        };

        const stopConsoleAnimation = () => {
            clearInterval(consoleInterval);
            consoleInterval = null;
            document.getElementById('thinking-animation')?.remove();
        };

        const ao_saveToProject = async (media) => {
            if (!activeProject) { alert(currentTranslations['select_project_alert']); return false; }
            const { error } = await sb.from('saved_media').insert({
                project_id: activeProject.id, user_id: user.id, name: media.name, url: media.url,
                description: media.description, reason: media.reason,
                relevance_score: media.relevanceScore, category: media.category,
            });
            if (error) { alert('Error saving media: ' + error.message); return false; }
            return true;
        };
        
        const ao_renderResults = (results) => {
            ao_resultsHeader.classList.toggle('hidden', results.length === 0);
            ao_resultsHeader.classList.toggle('flex', results.length > 0);
            ao_resultsContainer.innerHTML = results.map((res, index) => `
                <div class="bg-white p-4 rounded-xl shadow-sm border mb-4 flex gap-4">
                    <div class="flex-shrink-0 pt-1"><input type="checkbox" class="ao-result-checkbox h-5 w-5 text-[#BF103C] border-gray-300 rounded focus:ring-[#BF103C]" data-url="${res.url}"></div>
                    <div class="flex-grow">
                        <div class="flex justify-between items-start">
                            <div><h4 class="font-bold text-lg text-slate-800">${res.name}</h4><a href="${res.url}" target="_blank" rel="noopener noreferrer" class="text-sm text-sky-600">${res.url}</a></div>
                            <div class="flex-shrink-0 ml-4 text-right"><span class="category-tag bg-slate-200 text-slate-600">${res.category}</span><span class="ml-2 font-bold text-slate-700 block mt-1">${res.relevanceScore}/10</span></div>
                        </div>
                        <p class="text-sm text-slate-600 mt-2"><strong>Description:</strong> ${res.description}</p>
                        <p class="text-sm text-slate-600 mt-1"><strong>Reason:</strong> ${res.reason}</p>
                        <button class="ao-save-btn mt-3 bg-green-100 text-green-700 text-xs font-bold py-1 px-3 rounded-lg" data-result-index="${index}">${currentTranslations['save_to_project_btn'] || 'Save to Project'}</button>
                    </div>
                </div>`).join('');
            document.querySelectorAll('.ao-save-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const button = e.currentTarget;
                    const result = ao_currentResults[button.dataset.resultIndex];
                    button.disabled = true;
                    const success = await ao_saveToProject(result);
                    if (success) {
                        button.textContent = currentTranslations['media_saved'] || 'Saved ✔️';
                        button.classList.remove('bg-green-100', 'text-green-700');
                        button.classList.add('bg-slate-200', 'text-slate-500');
                    } else { button.disabled = false; }
                });
            });
        };

        ao_populateSelects();
        ao_keywordInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ao_addKeyword(); } });
        ao_addKeywordBtn.addEventListener('click', ao_addKeyword);
        ao_clearKeywordsBtn.addEventListener('click', () => { ao_keywords = []; ao_renderTags(); });

        const countryLanguageMap = { 'es': 'es', 'mx': 'es', 'ar': 'es', 'co': 'es', 'cl': 'es', 'pe': 'es', 'us': 'en', 'uk': 'en', 'de': 'de', 'fr': 'fr', 'it': 'it', 'pl': 'pl' };
        ao_countrySelect.addEventListener('change', () => {
            const selectedCountry = ao_countrySelect.value;
            if (countryLanguageMap[selectedCountry]) ao_languageSelect.value = countryLanguageMap[selectedCountry];
        });

        document.getElementById('ao-export-btn').addEventListener('click', () => {
            const selected = Array.from(document.querySelectorAll('.ao-result-checkbox:checked')).map(cb => cb.dataset.url);
            if (selected.length === 0) { alert('Please select media to export.'); return; }
            const textContent = selected.join('\n');
            const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'exported_affinity_media.txt';
            link.click();
            URL.revokeObjectURL(link.href);
        });

        ao_searchMediaBtn.addEventListener('click', async () => {
            if (ao_keywords.length === 0) { alert('Please add at least one keyword.'); return; }
            ao_searchMediaBtn.disabled = true; ao_searchMediaBtn.innerHTML = '<div class="loader"></div>';
            ao_logContainerWrapper.classList.remove('hidden'); ao_logContainer.innerHTML = '';
            ao_resultsContainer.innerHTML = ''; ao_resultsHeader.classList.add('hidden');
            ao_currentResults = [];
            startConsoleAnimation();
            let allSearchesSucceeded = true;
            const country = ao_countrySelect.value;
            const language = ao_languageSelect.value;
            const searchType = ao_searchTypeSelect.value;
            const promises = ao_keywords.map(kw =>
                fetch(`/.netlify/functions/affinity-search?keyword=${encodeURIComponent(kw)}&country=${country}&language=${language}&searchType=${searchType}`)
            );
            for (const promise of promises) {
                try {
                    const response = await promise;
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error || `Request failed with status ${response.status}`);
                    if (result.log) result.log.forEach(msg => logToConsole(ao_logContainer, msg));
                    if (result.directResults) ao_currentResults.push(...result.directResults);
                } catch (e) {
                    logToConsole(ao_logContainer, `[FATAL] A keyword search failed. ${e.message}`);
                    allSearchesSucceeded = false;
                }
            }
            stopConsoleAnimation();
            ao_currentResults = [...new Map(ao_currentResults.map(item => [item['url'], item])).values()];
            ao_currentResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
            ao_renderResults(ao_currentResults);
            const messageKey = allSearchesSucceeded ? 'search_success_message' : 'search_warn_message';
            const defaultMessage = allSearchesSucceeded ? "[SUCCESS] Search complete! Found {count} unique results. ✅" : "[WARN] Search finished, but some keywords failed. Found {count} results.";
            const message = (currentTranslations[messageKey] || defaultMessage).replace('{count}', ao_currentResults.length);
            logToConsole(ao_logContainer, message);
            ao_searchMediaBtn.disabled = false;
            ao_searchMediaBtn.innerHTML = currentTranslations['search_media_btn'] || 'Search Media';
        });
    }

    // =================================================================================
    // 🚀 MAIN APP CONTROLLER
    // =================================================================================
    const initializeApp = async (user) => {
        if (isAppInitialized) return;
        isAppInitialized = true;
        
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

        window.showOutreachSuiteView = (viewId) => {
            views.forEach(view => view.classList.add('hidden'));
            const targetView = document.getElementById(viewId + '-view');
            if (targetView) { targetView.classList.remove('hidden'); }
            else { document.getElementById('home-view').classList.remove('hidden'); }
            navLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === '#' + viewId));
            window.scrollTo(0, 0);
            if (viewId === 'projects') {
                document.getElementById('projects-list-view').classList.remove('hidden');
                document.getElementById('create-edit-project-container').classList.add('hidden');
                window.outreachSuite.loadProjects(user);
            }
            if (viewId === 'affinity-outreach' && window.outreachSuite.ao_loadProjectKeywords) {
                window.outreachSuite.ao_loadProjectKeywords();
            }
        };

        const handleLinkClick = (e) => {
            e.preventDefault();
            const viewId = e.currentTarget.getAttribute('href').substring(1);
            window.location.hash = viewId;
        };

        window.addEventListener('hashchange', () => {
            const viewId = window.location.hash ? window.location.hash.substring(1) : 'home';
            window.showOutreachSuiteView(viewId);
        });

        mobileMenuButton.addEventListener('click', toggleMenu);
        closeMenuButton.addEventListener('click', toggleMenu);
        overlay.addEventListener('click', toggleMenu);
        navLinks.forEach(link => link.addEventListener('click', handleLinkClick));
        viewSwitchers.forEach(switcher => switcher.addEventListener('click', handleLinkClick));
        
        const handleLanguageChange = async (lang) => {
            await sb.auth.updateUser({ data: { language: lang } });
            await translatePage(lang);
            // Dispatch a custom event to notify components that language has changed
            document.body.dispatchEvent(new CustomEvent('languageChanged'));
        };

        document.getElementById('lang-en')?.addEventListener('click', () => handleLanguageChange('en'));
        document.getElementById('lang-es')?.addEventListener('click', () => handleLanguageChange('es'));
        
        const setActiveProject = (project) => {
            activeProject = project;
            activeProjectDisplay.innerHTML = `<span class="font-normal mr-2">${currentTranslations['active_project'] || 'Active Project:'}</span> <strong>${project.name}</strong>`;
            document.querySelectorAll('.project-card').forEach(card => {
                card.classList.remove('border-sky-500', 'bg-sky-50');
                if (card.dataset.id == project.id) {
                    card.classList.add('border-sky-500', 'bg-sky-50');
                }
            });
            if (window.outreachSuite.ao_loadProjectKeywords) {
                window.outreachSuite.ao_loadProjectKeywords();
            }
        };
        
        const loadProjectDetails = async (projectId) => {
            const contentDiv = document.getElementById(`content-${projectId}`);
            if(!contentDiv) return;
            contentDiv.innerHTML = `<div class="p-4 border-t border-gray-200"><p class="text-slate-400">Loading details...</p></div>`;
            const { data: project, error } = await sb.from('projects').select('keywords').eq('id', projectId).single();
            const { data: media, error: mediaError } = await sb.from('saved_media').select('*').eq('project_id', projectId).order('created_at', { ascending: false });

            if (error || mediaError) {
                contentDiv.innerHTML = `<div class="p-4 border-t border-gray-200"><p class="text-red-500">Error loading details.</p></div>`;
                return;
            }
            
            let keywordsHtml = `<div><h5 class="font-bold mb-2">Keywords</h5><p class="text-sm text-slate-500">${currentTranslations['no_keywords_defined'] || 'No keywords defined.'}</p></div>`;
            if(project.keywords && project.keywords.length > 0) {
                keywordsHtml = `<div><h5 class="font-bold mb-2">Keywords</h5><div class="flex flex-wrap">${project.keywords.map(k => `<span class="bg-slate-200 text-slate-700 text-xs font-semibold mr-2 mb-2 px-2.5 py-0.5 rounded-full">${k}</span>`).join('')}</div></div>`;
            }
            
            let mediaHtml = `<div><h5 class="font-bold mb-2 mt-4" data-translate-key="saved_media_title"></h5><p class="text-sm text-slate-500">${currentTranslations['no_media_saved'] || 'No media saved yet.'}</p></div>`;
            if(media.length > 0) {
                mediaHtml = `
                    <div>
                        <div class="flex justify-between items-center mb-2 mt-4"><h5 class="font-bold" data-translate-key="saved_media_title"></h5></div>
                        <div class="space-y-2">${media.map(m => `
                            <div class="bg-slate-50 p-2 rounded-lg flex items-center gap-2">
                                <div class="flex-grow"><p class="font-semibold text-sm text-slate-700">${m.name}</p><a href="${m.url}" target="_blank" rel="noopener noreferrer" class="text-xs text-sky-600 truncate block">${m.url}</a></div>
                                <button class="hs-scrap-contact-btn bg-sky-100 text-sky-700 text-xs font-bold py-1 px-3 rounded-lg" data-url="${m.url}" data-translate-key="scrape_contact_btn"></button>
                            </div>`).join('')}</div>
                    </div>`;
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
                else { 
                    if(activeProject && activeProject.id === projectId) { activeProject = null; activeProjectDisplay.innerHTML = ''; } 
                    await window.outreachSuite.loadProjects(user);
                }
            }
        };

        window.outreachSuite.loadProjects = async (user) => {
            const projectsListContainer = document.getElementById('projects-list-container');
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
                    projectCard.className = 'project-card bg-white rounded-xl shadow-sm border border-gray-200 transition-all';
                    projectCard.dataset.id = project.id;
                    projectCard.innerHTML = `
                        <div class="project-accordion-header flex justify-between items-center p-4">
                            <div class="accordion-toggle flex-grow cursor-pointer pr-4">
                                <h4 class="font-bold text-lg text-slate-800">${project.name}</h4>
                                <p class="text-sm text-slate-500">${project.url || 'No URL'}</p>
                            </div>
                            <div class="flex items-center gap-2 flex-shrink-0 ml-4">
                                <button class="select-project-btn bg-sky-100 text-sky-700 text-xs font-bold py-1 px-3 rounded-lg hover:bg-sky-200" data-translate-key="select_project_btn">Set as Active</button>
                                <button class="edit-project-btn text-slate-500 hover:text-sky-600 p-2 rounded-full"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828zM5 12V7a2 2 0 012-2h2.586l-4 4H5z"></path></svg></button>
                                <button class="delete-project-btn text-slate-500 hover:text-red-600 p-2 rounded-full"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd"></path></svg></button>
                                <svg class="accordion-arrow w-5 h-5 text-slate-500 transition-transform" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
                            </div>
                        </div>
                        <div class="project-accordion-content" id="content-${project.id}"></div>`;
                    projectsListContainer.appendChild(projectCard);
                    projectCard.querySelector('.accordion-toggle').addEventListener('click', () => {
                        const content = projectCard.querySelector('.project-accordion-content');
                        const arrow = projectCard.querySelector('.accordion-arrow');
                        content.classList.toggle('open');
                        arrow.classList.toggle('open');
                        if(content.classList.contains('open') && !content.dataset.loaded) { loadProjectDetails(project.id); } 
                    });
                    projectCard.querySelector('.select-project-btn').addEventListener('click', () => setActiveProject(project));
                    projectCard.querySelector('.edit-project-btn').addEventListener('click', () => window.outreachSuite.editProjectCallback(project));
                    projectCard.querySelector('.delete-project-btn').addEventListener('click', () => deleteProject(project.id));
                });
                if (!activeProject || !projects.some(p => p.id === activeProject.id)) {
                   setActiveProject(projects[0]);
                } else {
                   const updatedActiveProject = projects.find(p => p.id === activeProject.id);
                   if (updatedActiveProject) setActiveProject(updatedActiveProject);
                }
            }
        };

        setupSettingsLogic(user);
        setupProjectsLogic(user);
        setupHybridScraperLogic(user);
        setupAffinityOutreachLogic(user);

        const initialView = window.location.hash ? window.location.hash.substring(1) : 'home';
        window.showOutreachSuiteView(initialView);
        await window.outreachSuite.loadProjects(user);
    };

    // =================================================================================
    // 🔒 AUTHENTICATION CONTROLLER
    // =================================================================================
    sb.auth.onAuthStateChange(async (event, session) => {
        const user = session?.user;
        if (session) {
            body.classList.remove('logged-out'); body.classList.add('logged-in');
            updateUserAvatar(user);
            await translatePage(user.user_metadata?.language || 'en');
            if (!isAppInitialized) {
                await initializeApp(user);
            }
        } else {
            body.classList.remove('logged-in'); body.classList.add('logged-out');
            isAppInitialized = false; activeProject = null;
            await translatePage('en');
            activeProjectDisplay.innerHTML = '';
        }
    });

    document.addEventListener('click', (e) => {
        const menu = document.getElementById('user-dropdown-menu');
        if (menu && !menu.classList.contains('hidden') && !e.target.closest('#user-profile-container')) {
            menu.classList.add('hidden');
        }
    });
    
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const authEmailInput = document.getElementById('auth-email');
    const authPasswordInput = document.getElementById('auth-password');
    const authLanguageSelect = document.getElementById('auth-language');

    loginBtn.addEventListener('click', async () => {
        const { error } = await sb.auth.signInWithPassword({ email: authEmailInput.value, password: authPasswordInput.value });
        if (error) showAuthMessage(error.message);
    });

    signupBtn.addEventListener('click', async () => {
        const { data, error } = await sb.auth.signUp({ 
            email: authEmailInput.value, 
            password: authPasswordInput.value, 
            options: { data: { language: authLanguageSelect.value } } 
        });
        if (error) { 
            showAuthMessage(error.message); 
        } else if (data.user && data.user.identities && data.user.identities.length === 0) {
            showAuthMessage("Signup successful, but there might be an issue. Please try logging in.", "success");
        }
        else { 
            showAuthMessage('Sign up successful! Please check your email to confirm your account.', 'success'); 
        }
    });

    authLanguageSelect.addEventListener('change', (e) => translatePage(e.target.value));
    
    const authFormContainer = document.getElementById('auth-form-container');
    const recoveryFormContainer = document.getElementById('recovery-form-container');
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const backToLoginLink = document.getElementById('back-to-login-link');
    const sendRecoveryBtn = document.getElementById('send-recovery-btn');
    const recoveryEmailInput = document.getElementById('recovery-email');

    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        authFormContainer.classList.add('hidden');
        recoveryFormContainer.classList.remove('hidden');
    });

    backToLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        recoveryFormContainer.classList.add('hidden');
        authFormContainer.classList.remove('hidden');
    });

    sendRecoveryBtn.addEventListener('click', async () => {
        const email = recoveryEmailInput.value;
        if (!email) {
            showAuthMessage("Please enter your email address.", "error");
            return;
        }
        sendRecoveryBtn.disabled = true;
        sendRecoveryBtn.innerHTML = '<div class="loader mx-auto"></div>';
        try {
            const { error } = await sb.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin, 
            });
            if (error) {
                showAuthMessage(error.message, 'error');
            } else {
                showAuthMessage("If an account exists for this email, a recovery link has been sent.", 'success');
                recoveryFormContainer.classList.add('hidden');
                authFormContainer.classList.remove('hidden');
            }
        } catch (catchedError) {
             showAuthMessage(catchedError.message, 'error');
        } finally {
            sendRecoveryBtn.disabled = false;
            sendRecoveryBtn.textContent = 'Send Recovery Link';
        }
    });

    setupPasswordToggle('toggle-auth-password', 'auth-password', 'eye-auth-open', 'eye-auth-closed');
});
// Диана и её настроение - App Logic with Firebase Sync

const firebaseConfig = {
    apiKey: "AIzaSyCOw2AjQmS7XmH2vObkfpa-HWUIg1qc7Hk",
    authDomain: "diana-threats.firebaseapp.com",
    databaseURL: "https://diana-threats-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "diana-threats",
    storageBucket: "diana-threats.firebasestorage.app",
    messagingSenderId: "857129102539",
    appId: "1:857129102539:web:104f1787511bf618f47f4e"
};

class DianaMoodTracker {
    constructor() {
        this.threats = [];
        this.offenses = [];
        this.nerves = [];
        this.db = null;
        this.connected = false;
        this.currentTab = 'threats';
        this.init();
    }

    async init() {
        // Установить сегодняшнюю дату по умолчанию
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('threatDate').value = today;
        document.getElementById('offenseDate').value = today;
        document.getElementById('nervesDate').value = today;

        // Привязать события форм
        document.getElementById('threatForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addThreat();
        });

        document.getElementById('offenseForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addOffense();
        });

        document.getElementById('nervesForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addNerves();
        });

        // Привязать события вкладок
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });

        // Загрузить локальные данные
        this.threats = this.loadLocalData('threats');
        this.offenses = this.loadLocalData('offenses');
        this.nerves = this.loadLocalData('nerves');
        this.renderThreats();
        this.renderOffenses();
        this.renderNerves();

        // Инициализация Firebase
        this.initFirebase();
    }

    switchTab(tabName) {
        this.currentTab = tabName;
        
        // Обновить вкладки
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Показать нужную секцию
        document.getElementById('threats-section').classList.toggle('hidden', tabName !== 'threats');
        document.getElementById('offenses-section').classList.toggle('hidden', tabName !== 'offenses');
        document.getElementById('nerves-section').classList.toggle('hidden', tabName !== 'nerves');
    }

    initFirebase() {
        this.updateSyncStatus('syncing');

        try {
            firebase.initializeApp(firebaseConfig);
            this.db = firebase.database();

            const connectionTimeout = setTimeout(() => {
                if (!this.connected) {
                    console.error('Таймаут подключения к Firebase');
                    this.updateSyncStatus('error');
                }
            }, 10000);

            this.db.ref('.info/connected').on('value', (snap) => {
                clearTimeout(connectionTimeout);
                this.connected = snap.val() === true;
                console.log('Подключение к Firebase:', this.connected);
                this.updateSyncStatus(this.connected ? 'connected' : 'error');
                
                if (this.connected) {
                    this.loadFromFirebase('threats');
                    this.loadFromFirebase('offenses');
                    this.loadFromFirebase('nerves');
                }
            });

        } catch (error) {
            console.error('Ошибка инициализации Firebase:', error);
            this.updateSyncStatus('error');
        }
    }

    loadFromFirebase(type) {
        this.db.ref(type).on('value', (snapshot) => {
            const data = snapshot.val();
            console.log(`Данные ${type} из Firebase:`, data);
            
            const items = data ? Object.keys(data).map(key => ({
                id: key,
                ...data[key]
            })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) : [];

            if (type === 'threats') {
                this.threats = items;
                this.saveLocalData('threats', this.threats);
                this.renderThreats();
            } else if (type === 'offenses') {
                this.offenses = items;
                this.saveLocalData('offenses', this.offenses);
                this.renderOffenses();
            } else if (type === 'nerves') {
                this.nerves = items;
                this.saveLocalData('nerves', this.nerves);
                this.renderNerves();
            }
        }, (error) => {
            console.error(`Ошибка чтения ${type}:`, error);
        });
    }

    loadLocalData(type) {
        try {
            const stored = localStorage.getItem(`diana_${type}`);
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    }

    saveLocalData(type, data) {
        localStorage.setItem(`diana_${type}`, JSON.stringify(data));
    }

    updateSyncStatus(status) {
        const statusEl = document.getElementById('syncStatus');
        const textEl = statusEl.querySelector('.sync-text');
        
        statusEl.className = 'sync-status';
        
        switch(status) {
            case 'connected':
                statusEl.classList.add('connected');
                textEl.textContent = 'Онлайн';
                break;
            case 'syncing':
                statusEl.classList.add('syncing');
                textEl.textContent = 'Подключение...';
                break;
            case 'error':
                statusEl.classList.add('error');
                textEl.textContent = 'Офлайн';
                break;
            default:
                textEl.textContent = 'Подключение...';
        }
    }

    // === УГРОЗЫ ===
    async addThreat() {
        const dateInput = document.getElementById('threatDate');
        const textInput = document.getElementById('threatText');
        const btn = document.getElementById('btnAddThreat');

        const date = dateInput.value;
        const text = textInput.value.trim();

        if (!date || !text) {
            this.shakeElement(textInput);
            return;
        }

        const item = {
            date: date,
            text: text,
            createdAt: new Date().toISOString()
        };

        btn.disabled = true;

        try {
            if (this.db && this.connected) {
                await this.db.ref('threats').push(item);
            } else {
                item.id = Date.now().toString();
                this.threats.unshift(item);
                this.saveLocalData('threats', this.threats);
                this.renderThreats();
            }
            
            textInput.value = '';
            this.showSuccessAnimation(btn);

        } catch (error) {
            console.error('Ошибка сохранения угрозы:', error);
            item.id = Date.now().toString();
            this.threats.unshift(item);
            this.saveLocalData('threats', this.threats);
            this.renderThreats();
        }

        btn.disabled = false;
    }

    async deleteThreat(id) {
        if (!confirm('Точно удалить эту угрозу? 😊')) return;

        try {
            if (this.db && this.connected) {
                await this.db.ref(`threats/${id}`).remove();
            } else {
                this.threats = this.threats.filter(t => t.id !== id);
                this.saveLocalData('threats', this.threats);
                this.renderThreats();
            }
        } catch (error) {
            console.error('Ошибка удаления угрозы:', error);
            this.threats = this.threats.filter(t => t.id !== id);
            this.saveLocalData('threats', this.threats);
            this.renderThreats();
        }
    }

    renderThreats() {
        const listEl = document.getElementById('threatsList');
        const emptyState = document.getElementById('threatsEmpty');
        const countEl = document.getElementById('threatCount');

        const count = this.threats.length;
        countEl.textContent = `${count} ${this.getWord(count, 'угроза')}`;

        if (count === 0) {
            emptyState.classList.add('show');
            listEl.innerHTML = '';
            return;
        }

        emptyState.classList.remove('show');

        listEl.innerHTML = this.threats.map(item => `
            <div class="item-card threat" data-id="${item.id}">
                <div class="item-header">
                    <span class="item-date">📅 ${this.formatDate(item.date)}</span>
                    <button class="btn-delete" onclick="app.deleteThreat('${item.id}')" title="Удалить">🗑️</button>
                </div>
                <div class="item-text">"${this.escapeHtml(item.text)}"</div>
            </div>
        `).join('');
    }

    // === ОБИДЫ ===
    async addOffense() {
        const dateInput = document.getElementById('offenseDate');
        const textInput = document.getElementById('offenseText');
        const btn = document.getElementById('btnAddOffense');

        const date = dateInput.value;
        const text = textInput.value.trim();

        if (!date || !text) {
            this.shakeElement(textInput);
            return;
        }

        const item = {
            date: date,
            text: text,
            createdAt: new Date().toISOString()
        };

        btn.disabled = true;

        try {
            if (this.db && this.connected) {
                await this.db.ref('offenses').push(item);
            } else {
                item.id = Date.now().toString();
                this.offenses.unshift(item);
                this.saveLocalData('offenses', this.offenses);
                this.renderOffenses();
            }
            
            textInput.value = '';
            this.showSuccessAnimation(btn);

        } catch (error) {
            console.error('Ошибка сохранения обиды:', error);
            item.id = Date.now().toString();
            this.offenses.unshift(item);
            this.saveLocalData('offenses', this.offenses);
            this.renderOffenses();
        }

        btn.disabled = false;
    }

    async deleteOffense(id) {
        if (!confirm('Точно удалить эту обиду? 😊')) return;

        try {
            if (this.db && this.connected) {
                await this.db.ref(`offenses/${id}`).remove();
            } else {
                this.offenses = this.offenses.filter(t => t.id !== id);
                this.saveLocalData('offenses', this.offenses);
                this.renderOffenses();
            }
        } catch (error) {
            console.error('Ошибка удаления обиды:', error);
            this.offenses = this.offenses.filter(t => t.id !== id);
            this.saveLocalData('offenses', this.offenses);
            this.renderOffenses();
        }
    }

    renderOffenses() {
        const listEl = document.getElementById('offensesList');
        const emptyState = document.getElementById('offensesEmpty');
        const countEl = document.getElementById('offenseCount');

        const count = this.offenses.length;
        countEl.textContent = `${count} ${this.getWord(count, 'обида')}`;

        if (count === 0) {
            emptyState.classList.add('show');
            listEl.innerHTML = '';
            return;
        }

        emptyState.classList.remove('show');

        listEl.innerHTML = this.offenses.map(item => `
            <div class="item-card offense" data-id="${item.id}">
                <div class="item-header">
                    <span class="item-date">📅 ${this.formatDate(item.date)}</span>
                    <button class="btn-delete" onclick="app.deleteOffense('${item.id}')" title="Удалить">🗑️</button>
                </div>
                <div class="item-text">"${this.escapeHtml(item.text)}"</div>
            </div>
        `).join('');
    }

    // === НЕРВЫ ===
    async addNerves() {
        const dateInput = document.getElementById('nervesDate');
        const textInput = document.getElementById('nervesText');
        const btn = document.getElementById('btnAddNerves');

        const date = dateInput.value;
        const text = textInput.value.trim();

        if (!date || !text) {
            this.shakeElement(textInput);
            return;
        }

        const item = {
            date: date,
            text: text,
            createdAt: new Date().toISOString()
        };

        btn.disabled = true;

        try {
            if (this.db && this.connected) {
                await this.db.ref('nerves').push(item);
            } else {
                item.id = Date.now().toString();
                this.nerves.unshift(item);
                this.saveLocalData('nerves', this.nerves);
                this.renderNerves();
            }
            
            textInput.value = '';
            this.showSuccessAnimation(btn);

        } catch (error) {
            console.error('Ошибка сохранения пытки:', error);
            item.id = Date.now().toString();
            this.nerves.unshift(item);
            this.saveLocalData('nerves', this.nerves);
            this.renderNerves();
        }

        btn.disabled = false;
    }

    async deleteNerves(id) {
        if (!confirm('Точно удалить эту попытку? 😊')) return;

        try {
            if (this.db && this.connected) {
                await this.db.ref(`nerves/${id}`).remove();
            } else {
                this.nerves = this.nerves.filter(t => t.id !== id);
                this.saveLocalData('nerves', this.nerves);
                this.renderNerves();
            }
        } catch (error) {
            console.error('Ошибка удаления пытки:', error);
            this.nerves = this.nerves.filter(t => t.id !== id);
            this.saveLocalData('nerves', this.nerves);
            this.renderNerves();
        }
    }

    renderNerves() {
        const listEl = document.getElementById('nervesList');
        const emptyState = document.getElementById('nervesEmpty');
        const countEl = document.getElementById('nervesCount');

        const count = this.nerves.length;
        countEl.textContent = `${count} ${this.getWord(count, 'попытка')}`;

        if (count === 0) {
            emptyState.classList.add('show');
            listEl.innerHTML = '';
            return;
        }

        emptyState.classList.remove('show');

        listEl.innerHTML = this.nerves.map(item => `
            <div class="item-card nerves" data-id="${item.id}">
                <div class="item-header">
                    <span class="item-date">📅 ${this.formatDate(item.date)}</span>
                    <button class="btn-delete" onclick="app.deleteNerves('${item.id}')" title="Удалить">🗑️</button>
                </div>
                <div class="item-text">"${this.escapeHtml(item.text)}"</div>
            </div>
        `).join('');
    }

    // === УТИЛИТЫ ===
    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('ru-RU', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        });
    }

    getWord(count, base) {
        const forms = {
            'угроза': ['угроза', 'угрозы', 'угроз'],
            'обида': ['обида', 'обиды', 'обид'],
            'попытка': ['попытка', 'попытки', 'попыток']
        };
        
        const f = forms[base] || [base, base, base];
        const lastTwo = count % 100;
        const lastOne = count % 10;

        if (lastTwo >= 11 && lastTwo <= 19) return f[2];
        if (lastOne === 1) return f[0];
        if (lastOne >= 2 && lastOne <= 4) return f[1];
        return f[2];
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showSuccessAnimation(btn) {
        const textEl = btn.querySelector('.btn-text');
        const originalText = textEl.textContent;
        
        btn.classList.add('success');
        textEl.textContent = '✅ Добавлено!';
        
        setTimeout(() => {
            btn.classList.remove('success');
            textEl.textContent = originalText;
        }, 1500);
    }

    shakeElement(element) {
        element.style.animation = 'none';
        element.offsetHeight;
        element.style.animation = 'shake 0.5s ease';
        setTimeout(() => element.style.animation = '', 500);
    }
}

// Shake animation
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-10px); }
        75% { transform: translateX(10px); }
    }
`;
document.head.appendChild(style);

// Инициализация
const app = new DianaMoodTracker();
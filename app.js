// Угрозы от Дианы - App Logic with Firebase Sync

const firebaseConfig = {
    apiKey: "AIzaSyCOw2AjQmS7XmH2vObkfpa-HWUIg1qc7Hk",
    authDomain: "diana-threats.firebaseapp.com",
    databaseURL: "https://diana-threats-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "diana-threats",
    storageBucket: "diana-threats.firebasestorage.app",
    messagingSenderId: "857129102539",
    appId: "1:857129102539:web:104f1787511bf618f47f4e"
};

class DianaThreats {
    constructor() {
        this.threats = [];
        this.db = null;
        this.connected = false;
        this.init();
    }

    async init() {
        // Установить сегодняшнюю дату по умолчанию
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('threatDate').value = today;

        // Привязать события
        document.getElementById('threatForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addThreat();
        });

        // Загрузить локальные данные сразу
        this.threats = this.loadLocalThreats();
        this.renderThreats();

        // Инициализация Firebase
        await this.initFirebase();
    }

    async initFirebase() {
        try {
            this.updateSyncStatus('syncing');

            // Инициализация Firebase
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }

            this.db = firebase.database();

            // Анонимная авторизация (нужна для test mode)
            await firebase.auth().signInAnonymously();

            // Слушаем состояние подключения
            this.db.ref('.info/connected').on('value', (snap) => {
                this.connected = snap.val() === true;
                this.updateSyncStatus(this.connected ? 'connected' : 'error');
            });

            // Слушаем угрозы
            this.db.ref('threats').on('value', (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    this.threats = Object.keys(data).map(key => ({
                        id: key,
                        ...data[key]
                    })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                } else {
                    this.threats = [];
                }
                this.saveLocalThreats();
                this.renderThreats();
            }, (error) => {
                console.error('Ошибка чтения:', error);
                this.updateSyncStatus('error');
            });

        } catch (error) {
            console.error('Ошибка Firebase:', error);
            this.updateSyncStatus('error');
        }
    }

    loadLocalThreats() {
        try {
            const stored = localStorage.getItem('dianaThreats');
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    }

    saveLocalThreats() {
        localStorage.setItem('dianaThreats', JSON.stringify(this.threats));
    }

    updateSyncStatus(status) {
        const statusEl = document.getElementById('syncStatus');
        const textEl = statusEl.querySelector('.sync-text');
        
        statusEl.className = 'sync-status';
        
        switch(status) {
            case 'connected':
                statusEl.classList.add('connected');
                textEl.textContent = 'Синхронизировано';
                break;
            case 'syncing':
                statusEl.classList.add('syncing');
                textEl.textContent = 'Подключение...';
                break;
            case 'error':
                statusEl.classList.add('error');
                textEl.textContent = 'Нет связи';
                break;
            default:
                textEl.textContent = 'Подключение...';
        }
    }

    async addThreat() {
        const dateInput = document.getElementById('threatDate');
        const textInput = document.getElementById('threatText');
        const btn = document.getElementById('btnAdd');

        const date = dateInput.value;
        const text = textInput.value.trim();

        if (!date || !text) {
            this.shakeElement(textInput);
            return;
        }

        const threat = {
            date: date,
            text: text,
            createdAt: new Date().toISOString()
        };

        btn.disabled = true;
        this.updateSyncStatus('syncing');

        try {
            if (this.db) {
                await this.db.ref('threats').push(threat);
            } else {
                // Fallback
                threat.id = Date.now().toString();
                this.threats.unshift(threat);
                this.saveLocalThreats();
                this.renderThreats();
            }
            
            textInput.value = '';
            this.showSuccessAnimation();
            
            if (this.connected) {
                this.updateSyncStatus('connected');
            }
        } catch (error) {
            console.error('Ошибка сохранения:', error);
            this.updateSyncStatus('error');
            
            // Fallback
            threat.id = Date.now().toString();
            this.threats.unshift(threat);
            this.saveLocalThreats();
            this.renderThreats();
        }

        btn.disabled = false;
    }

    async deleteThreat(id) {
        if (!confirm('Точно удалить эту угрозу? Она была такой милой... 😊')) {
            return;
        }

        try {
            if (this.db) {
                await this.db.ref(`threats/${id}`).remove();
            } else {
                this.threats = this.threats.filter(t => t.id !== id);
                this.saveLocalThreats();
                this.renderThreats();
            }
        } catch (error) {
            console.error('Ошибка удаления:', error);
            this.threats = this.threats.filter(t => t.id !== id);
            this.saveLocalThreats();
            this.renderThreats();
        }
    }

    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('ru-RU', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        });
    }

    getThreatWord(count) {
        const lastTwo = count % 100;
        const lastOne = count % 10;

        if (lastTwo >= 11 && lastTwo <= 19) return 'угроз';
        if (lastOne === 1) return 'угроза';
        if (lastOne >= 2 && lastOne <= 4) return 'угрозы';
        return 'угроз';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    renderThreats() {
        const listEl = document.getElementById('threatsList');
        const emptyState = document.getElementById('emptyState');
        const countEl = document.getElementById('threatCount');

        const count = this.threats.length;
        countEl.textContent = `${count} ${this.getThreatWord(count)}`;

        if (count === 0) {
            emptyState.classList.add('show');
            listEl.innerHTML = '';
            return;
        }

        emptyState.classList.remove('show');

        listEl.innerHTML = this.threats.map(threat => `
            <div class="threat-card" data-id="${threat.id}">
                <div class="threat-header">
                    <span class="threat-date">📅 ${this.formatDate(threat.date)}</span>
                    <button class="btn-delete" onclick="app.deleteThreat('${threat.id}')" title="Удалить">
                        🗑️
                    </button>
                </div>
                <div class="threat-text">"${this.escapeHtml(threat.text)}"</div>
            </div>
        `).join('');
    }

    showSuccessAnimation() {
        const btn = document.getElementById('btnAdd');
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

// Добавить анимацию shake
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
const app = new DianaThreats();
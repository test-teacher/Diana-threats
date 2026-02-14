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
        this.isOnline = false;
        this.init();
    }

    async init() {
        // Показать loading
        this.showLoading();

        // Установить сегодняшнюю дату по умолчанию
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('threatDate').value = today;

        // Привязать события
        document.getElementById('threatForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addThreat();
        });

        // Инициализация Firebase
        await this.initFirebase();

        // Загрузить локальные данные (пока Firebase грузится)
        this.threats = this.loadLocalThreats();
        this.renderThreats();

        // Скрыть loading
        this.hideLoading();
    }

    async initFirebase() {
        try {
            // Проверка, что Firebase config заполнен
            if (firebaseConfig.apiKey === "YOUR_API_KEY") {
                console.warn('Firebase не настроен. Используется локальное хранилище.');
                this.updateSyncStatus('local');
                return;
            }

            // Инициализация Firebase
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }

            this.db = firebase.database();
            
            // Проверка подключения
            await this.testConnection();

            // Слушать изменения в реальном времени
            this.listenForChanges();

        } catch (error) {
            console.error('Ошибка Firebase:', error);
            this.updateSyncStatus('error');
        }
    }

    async testConnection() {
        return new Promise((resolve) => {
            const connectedRef = this.db.ref('.info/connected');
            connectedRef.on('value', (snap) => {
                if (snap.val() === true) {
                    this.isOnline = true;
                    this.updateSyncStatus('connected');
                    resolve(true);
                } else {
                    this.isOnline = false;
                    this.updateSyncStatus('error');
                    resolve(false);
                }
            });
        });
    }

    listenForChanges() {
        if (!this.db) return;

        const threatsRef = this.db.ref('threats');
        
        // Слушаем изменения
        threatsRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                // Преобразуем объект в массив и сортируем по дате
                this.threats = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                })).sort((a, b) => {
                    // Сортировка по дате создания (новые первыми)
                    return new Date(b.createdAt) - new Date(a.createdAt);
                });
            } else {
                this.threats = [];
            }
            
            // Сохранить локально как резерв
            this.saveLocalThreats();
            
            // Обновить отображение
            this.renderThreats();
        });

        // Обработка ошибок
        threatsRef.on('error', (error) => {
            console.error('Ошибка синхронизации:', error);
            this.updateSyncStatus('error');
        });
    }

    loadLocalThreats() {
        const stored = localStorage.getItem('dianaThreats');
        return stored ? JSON.parse(stored) : [];
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
                textEl.textContent = 'Синхронизация...';
                break;
            case 'error':
                statusEl.classList.add('error');
                textEl.textContent = 'Нет связи';
                break;
            case 'local':
                statusEl.classList.add('error');
                textEl.textContent = 'Только локально';
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

        // Показать синхронизацию
        this.updateSyncStatus('syncing');

        // Блокируем кнопку
        btn.disabled = true;

        try {
            if (this.db && this.isOnline) {
                // Сохранить в Firebase
                const newRef = this.db.ref('threats').push();
                await newRef.set(threat);
            } else {
                // Fallback - локальное сохранение
                threat.id = Date.now();
                this.threats.unshift(threat);
                this.saveLocalThreats();
                this.renderThreats();
            }

            // Очистить форму
            textInput.value = '';
            
            // Показать успех
            this.showSuccessAnimation();
            this.updateSyncStatus('connected');

        } catch (error) {
            console.error('Ошибка сохранения:', error);
            this.updateSyncStatus('error');
            
            // Сохранить локально как fallback
            threat.id = Date.now();
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

        this.updateSyncStatus('syncing');

        try {
            if (this.db && this.isOnline) {
                await this.db.ref(`threats/${id}`).remove();
            } else {
                this.threats = this.threats.filter(t => t.id !== id);
                this.saveLocalThreats();
                this.renderThreats();
            }
            this.updateSyncStatus('connected');
        } catch (error) {
            console.error('Ошибка удаления:', error);
            this.updateSyncStatus('error');
            
            // Удалить локально
            this.threats = this.threats.filter(t => t.id !== id);
            this.saveLocalThreats();
            this.renderThreats();
        }
    }

    formatDate(dateStr) {
        const date = new Date(dateStr);
        const options = { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        };
        return date.toLocaleDateString('ru-RU', options);
    }

    getThreatWord(count) {
        const lastTwo = count % 100;
        const lastOne = count % 10;

        if (lastTwo >= 11 && lastTwo <= 19) {
            return 'угроз';
        }
        if (lastOne === 1) {
            return 'угроза';
        }
        if (lastOne >= 2 && lastOne <= 4) {
            return 'угрозы';
        }
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

        // Обновить счётчик
        const count = this.threats.length;
        countEl.textContent = `${count} ${this.getThreatWord(count)}`;

        // Показать/скрыть пустое состояние
        if (count === 0) {
            emptyState.classList.add('show');
            listEl.innerHTML = '';
            return;
        }

        emptyState.classList.remove('show');

        // Рендеринг угроз
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
        element.offsetHeight; // Trigger reflow
        element.style.animation = 'shake 0.5s ease';
        
        setTimeout(() => {
            element.style.animation = '';
        }, 500);
    }

    showLoading() {
        // Создать overlay если его нет
        if (!document.querySelector('.loading-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <p>Загрузка...</p>
                </div>
            `;
            document.body.appendChild(overlay);
        }
    }

    hideLoading() {
        const overlay = document.querySelector('.loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            setTimeout(() => overlay.remove(), 300);
        }
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

// Инициализация приложения
const app = new DianaThreats();
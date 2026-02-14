// Угрозы от Дианы - App Logic

class DianaThreats {
    constructor() {
        this.threats = this.loadThreats();
        this.init();
    }

    init() {
        // Установить сегодняшнюю дату по умолчанию
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('threatDate').value = today;

        // Привязать события
        document.getElementById('threatForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addThreat();
        });

        // Отобразить угрозы
        this.renderThreats();
    }

    loadThreats() {
        const stored = localStorage.getItem('dianaThreats');
        return stored ? JSON.parse(stored) : [];
    }

    saveThreats() {
        localStorage.setItem('dianaThreats', JSON.stringify(this.threats));
    }

    addThreat() {
        const dateInput = document.getElementById('threatDate');
        const textInput = document.getElementById('threatText');

        const date = dateInput.value;
        const text = textInput.value.trim();

        if (!date || !text) {
            alert('Пожалуйста, заполни дату и текст угрозы!');
            return;
        }

        const threat = {
            id: Date.now(),
            date: date,
            text: text,
            createdAt: new Date().toISOString()
        };

        this.threats.unshift(threat); // Добавить в начало
        this.saveThreats();
        this.renderThreats();

        // Очистить форму
        textInput.value = '';
        
        // Показать анимацию успеха
        this.showSuccessAnimation();
    }

    deleteThreat(id) {
        if (confirm('Точно удалить эту угрозу? Она была такой милой... 😊')) {
            this.threats = this.threats.filter(t => t.id !== id);
            this.saveThreats();
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
                    <button class="btn-delete" onclick="app.deleteThreat(${threat.id})" title="Удалить">
                        🗑️
                    </button>
                </div>
                <div class="threat-text">"${this.escapeHtml(threat.text)}"</div>
            </div>
        `).join('');
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

    showSuccessAnimation() {
        const btn = document.querySelector('.btn-add');
        const originalText = btn.innerHTML;
        btn.innerHTML = '✅ Добавлено!';
        btn.style.background = 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)';
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = '';
        }, 1500);
    }
}

// Инициализация приложения
const app = new DianaThreats();
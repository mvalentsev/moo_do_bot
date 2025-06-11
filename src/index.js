export default {
    async scheduled(event, env, ctx) {
        const monitor = new SiteMonitor(env);
        await monitor.checkAndNotify(ctx);
    }
};

class SiteMonitor {
    constructor(env) {
        this.env = env;
        this.kv = env.CACHE;
        this.ai = env.AI;
        this.telegramApi = `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`;
        this.muteDuration = 60 * 60 * 1000; // 60 минут
        this.timeout = 10000; // 10 секунд таймаут
    }

    async checkAndNotify(ctx) {
        const now = Date.now();

        if (!await this.shouldAlert(now)) {
            return;
        }

        const siteStatus = await this.checkSiteHealth();

        if (siteStatus.isDown) {
            await this.sendAlert(siteStatus, now);
            ctx.waitUntil(this.generateNextMessage());
        } else {
            //await this.kv.delete("lastAlertTime");
        }
    }

    async shouldAlert(now) {
        const lastAlert = await this.kv.get("lastAlertTime");
        const lastAlertTime = lastAlert ? parseInt(lastAlert) : 0;
        return now - lastAlertTime > this.muteDuration;
    }

    async checkSiteHealth() {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(this.env.URL, {
                method: "HEAD",
                headers: {
                    "User-Agent": "UptimeMonitor/2.0 (Cloudflare Worker)",
                    "Accept": "*/*",
                    "Cache-Control": "no-cache"
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            return {
                isDown: response.status >= 500 || response.status === 0,
                status: response.status,
                error: response.status >= 500 ? `HTTP ${response.status}` : null
            };

        } catch (error) {
            clearTimeout(timeoutId);

            return {
                isDown: true,
                status: 0,
                error: this.categorizeError(error)
            };
        }
    }

    categorizeError(error) {
        if (error.name === 'AbortError') return 'Таймаут соединения';
        if (error.message.includes('getaddrinfo')) return 'DNS недоступен';
        if (error.message.includes('connect')) return 'Соединение отклонено';
        return 'Неизвестная ошибка сети';
    }

    async sendAlert(siteStatus, timestamp) {
        const message = await this.getCurrentMessage();
        const fullMessage = this.formatAlertMessage(message, siteStatus);

        try {
            const response = await fetch(this.telegramApi, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: this.env.CHAT_ID,
                    text: fullMessage,
                    parse_mode: "HTML"
                })
            });

            if (response.ok) {
                await this.kv.put("lastAlertTime", String(timestamp));
            }
        } catch (error) {
            console.error("Ошибка отправки в Telegram:", error);
        }
    }

    formatAlertMessage(aiMessage, siteStatus) {
        const statusEmoji = this.getStatusEmoji(siteStatus);
        const timeStamp = new Date().toLocaleString('ru-RU', {
            timeZone: 'Europe/Moscow',
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `${statusEmoji} <b>АЛЛО!</b>\n\n` +
            `${aiMessage}\n\n` +
            `<i>Ошибка:</i> <code>${siteStatus.error}</code>\n` +
            `<i>Время:</i> <code>${timeStamp} МСК</code>`;
    }

    getStatusEmoji(siteStatus) {
        if (siteStatus.status >= 500) return "🔥";
        if (siteStatus.status === 0) return "💀";
        return "⚠️";
    }

    async getCurrentMessage() {
        let message = await this.kv.get("cachedMessage");

        if (!message) {
            message = "Коллеги, у вас снова все сломалось. Как обычно.";
            // Генерируем новое сообщение в фоне
            this.generateNextMessage();
        }

        return message;
    }

    async generateNextMessage() {
        const aiMessage = await this.requestAIMessage();
        if (aiMessage) {
            await this.kv.put("cachedMessage", aiMessage);
        }
    }

    async requestAIMessage() {
        const prompts = [
            "Ты язвительный DevOps-инженер. Сервер упал с 500-й ошибкой. Напиши ОДНО короткое саркастичное предложение разработчикам на русском языке. Будь остроумным и беспощадным.",
            "Ты недовольный системный администратор. Сайт снова недоступен. Выскажись ОДНИМ язвительным предложением команде на русском. Используй сарказм и профессиональный цинизм.",
            "Ты мониторинг-бот с характером. Опять проблемы с сервером. Сделай ОДНО саркастичное замечание разработчикам на русском языке. Будь остроумно злым.",
            "Ты опытный DevOps с черным юмором. Сервер сломался. Напиши ОДНУ едкую фразу для команды на русском. Используй профессиональный сарказм.",
            "Ты старый DevOps с багажом знаний. Очередной инцидент. Напиши ОДНУ ироничную фразу на русском для команды разработки. Покажи профессиональную усталость от багов."
        ];

        try {
            const systemPrompt = "Ты опытный DevOps-инженер с язвительным чувством юмора. Отвечай ТОЛЬКО на русском языке. Используй профессиональный IT-сленг и сарказм. Ответ должен быть ОДНИМ предложением, максимум 150 символов.";
            const userPrompt = prompts[Math.floor(Math.random() * prompts.length)];

            const response = await this.ai.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                max_tokens: 100,
                temperature: 0.9,
                top_p: 0.95
            });

            const message = response?.response?.trim();
            return message ? this.sanitizeMessage(message) : this.getRandomFallbackMessage();
        } catch (error) {
            console.error("Ошибка генерации сообщения с Cloudflare AI:", error);

            // Пробуем альтернативную модель
            try {
                const response = await this.ai.run('@cf/mistral/mistral-7b-instruct-v0.1', {
                    prompt: "Ты язвительный DevOps. Сервер упал. Одно саркастичное предложение на русском:",
                    max_tokens: 80,
                    temperature: 0.8
                });

                const message = response?.response?.trim();
                return message ? this.sanitizeMessage(message) : this.getRandomFallbackMessage();
            } catch (fallbackError) {
                console.error("Ошибка fallback модели:", fallbackError);
                return this.getRandomFallbackMessage();
            }
        }
    }

    sanitizeMessage(message) {
        if (!message) return null;

        // Убираем лишние символы и ограничиваем длину
        return message
            .replace(/["\n\r\t]/g, '')
            .substring(0, 200)
            .trim();
    }

    getRandomFallbackMessage() {
        const fallbacks = [
            "Всем чмоки в этом чате, у вас пятихат",
            "Коллеги, сервер опять приказал долго жить. Как всегда в самый неподходящий момент.",
            "Поздравляю! Ваш код достиг нового уровня нестабильности.",
            "Сервер решил взять незапланированный отпуск. Опять.",
            "Хорошие новости: сервер работает! Плохие новости: в параллельной вселенной.",
            "Сайт недоступен. Но зато как красиво недоступен!",
            "Сервер показывает класс. Мастер-класс по падению.",
            "500-я ошибка — это не баг, это фича! Очень дорогая фича.",
            "Сервер ушел в отпуск без предупреждения. Видимо, выгорел.",
            "Код работает по принципу 'иногда да, иногда нет'. Сегодня — нет.",
            "Мониторинг показывает: все плохо. Как обычно."
        ];

        return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }
}
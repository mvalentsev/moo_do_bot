export default {
    async scheduled(event, env, ctx) {
        const url = env.URL;
        const KV = env.CACHE;
        const now = Date.now();
        const muteDuration = 60 * 60 * 1000; // 60 минут

        const telegramApi = `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`;
        const lastAlertStr = await KV.get("lastAlertTime");
        const lastAlertTime = lastAlertStr ? parseInt(lastAlertStr) : 0;
        const shouldSend = now - lastAlertTime > muteDuration;

        let message = await KV.get("message");
        if (!message) {
            message = "Всем чмоки в этом чате, у вас пятихат";
        }

        let isError = false;

        try {
            const res = await fetch(url, { method: "GET", headers: { "User-Agent": "UptimeBot" } });
            if (res.status >= 500) isError = true;
            //else await KV.delete("lastAlertTime");
        } catch (e) {
            isError = true;
        }

        if (isError && shouldSend) {
            await fetch(telegramApi, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: env.CHAT_ID, text: message }),
            });

            await KV.put("lastAlertTime", String(now));

            ctx.waitUntil(updateMessage(KV, env));
        }
    }
};

async function updateMessage(KV, env) {
    try {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemma-3n-e4b-it:generateContent?key=${env.GEMINI_API_KEY}`;
        const payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": `Ты едкий и беспощадный DevOps-бот. Оповести коллег о 500-й ошибке на сервере, используя язвительную и максимально саркастичную фразу. Ответь одним коротким предложением, которое врежет по самолюбию`
                        }
                    ]
                }
            ]
        };

        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();
        const newMsg = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (newMsg) {
            await KV.put("message", newMsg);
        }
    } catch (e) {

    }
}


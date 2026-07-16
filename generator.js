const fs = require('fs');
const path = require('path');
const https = require('https');

// ==========================================
// 1. КОНФИГУРАЦИЯ И СИСТЕМНЫЕ НАСТРОЙКИ
// ==========================================
const SITE_URL = process.env.SITE_URL ? process.env.SITE_URL.replace(/\/$/, "") : "https://yourdomain.com";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OUTPUT_DIR = path.join(__dirname, 'dist');
const CACHE_FILE = path.join(__dirname, 'cache.json');
const PROMPT_FILE = path.join(__dirname, 'prompt.txt');

// Инициализация кэша
let cache = { accent_color: "#3182ce", articles: [] };
if (fs.existsSync(CACHE_FILE)) {
    try {
        cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    } catch (e) {
        console.warn("⚠️ Файл кэша поврежден. Инициализируем новый.");
    }
}

// ==========================================
// 2. БАЗОВЫЙ HTML-ШАБЛОН С ПОЛНЫМ НАБОРОМ ПРАВОК
// ==========================================
const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="\${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>\${meta_title}</title>
    <meta name="description" content="\${meta_desc}">
    <meta name="robots" content="index, follow, max-image-preview:large">
    
    <!-- Мультиязычные альтернативные ссылки (Hreflang) -->
    \${hreflangs}

    <!-- Микроразметка Schema.org (JSON-LD) для E-E-A-T (Article & FAQ) -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "headline": "\${h1}",
      "description": "\${meta_desc}",
      "image": ["\${site_url}/assets/images/\${art_id}-cover.png"],
      "datePublished": "\${pub_date_iso}",
      "dateModified": "\${pub_date_iso}",
      "author": {
        "@type": "Person",
        "name": "\${author_name}",
        "jobTitle": "\${author_role}",
        "description": "\${author_bio}"
      },
      "publisher": {
        "@type": "Organization",
        "name": "\${domain_name}",
        "logo": {
          "@type": "ImageObject",
          "url": "\${site_url}/logo.png"
        }
      }
    }
    </script>

    <!-- Микроразметка FAQ-блока -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": \${faq_schema_json}
    }
    </script>

    <!-- КРИТИЧЕСКИЙ CSS & РЕГУЛИРОВКА ЦВЕТОВЫХ ТЕМ -->
    <style>
        :root {
            --primary-color: \${accent_color};
            --bg-color: #ffffff;
            --text-color: #2d3748;
            --card-bg: #f7fafc;
            --border-color: #e2e8f0;
        }
        @media (prefers-color-scheme: dark) {
            :root {
                --bg-color: #1a202c;
                --text-color: #e2e8f0;
                --card-bg: #2d3748;
                --border-color: #4a5568;
            }
        }
        body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.7;
            /* Защита от парсинга: Запрет выделения контента */
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            user-select: none;
        }
        a { color: var(--primary-color); text-decoration: none; font-weight: 500; }
        a:hover { text-decoration: underline; }
        .nav-container { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--border-color); padding-bottom: 15px; margin-bottom: 30px; }
        .nav-links a { margin-right: 15px; }
        .lang-switch a { padding: 5px 10px; border: 1px solid var(--border-color); border-radius: 4px; }
        .author-box {
            display: flex;
            align-items: center;
            background: var(--card-bg);
            padding: 20px;
            border-radius: 8px;
            margin: 25px 0;
            border-left: 4px solid var(--primary-color);
        }
        .tldr-box {
            background: #fffaf0;
            border-left: 4px solid #dd6b20;
            padding: 20px;
            margin: 25px 0;
            border-radius: 4px;
            color: #2d3748;
        }
        .tldr-box ul { margin: 10px 0 0 20px; padding: 0; }
        .article-content table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .article-content th, .article-content td { padding: 10px; border: 1px solid var(--border-color); text-align: left; }
        .article-content th { background-color: var(--card-bg); }
        .cover-svg { width: 100%; height: auto; aspect-ratio: 16/9; border-radius: 8px; margin-bottom: 25px; }
        .faq-section { margin-top: 40px; }
        .faq-item { margin-bottom: 15px; padding: 15px; background: var(--card-bg); border-radius: 6px; }
        .faq-item summary { font-weight: bold; cursor: pointer; outline: none; }
        .faq-item p { margin-top: 10px; margin-bottom: 0; }
        .related-box { margin-top: 50px; padding: 25px 0; border-top: 2px solid var(--border-color); }
        .related-box ul { list-style: none; padding: 0; }
        .related-box li { margin-bottom: 10px; }
        footer { margin-top: 60px; text-align: center; font-size: 0.85em; opacity: 0.7; padding-top: 20px; border-top: 1px solid var(--border-color); }
    </style>

    <!-- Speculation Rules API для мгновенного предрендеринга -->
    <script type="speculationrules">
    {
      "prerender": [
        {
          "source": "list",
          "urls": \${speculation_urls}
        }
      ]
    }
    </script>
</head>
<body>

    <header class="nav-container">
        <nav class="nav-links">\${nav_links}</nav>
        <div class="lang-switch">\${lang_switches}</div>
    </header>

    <main>
        <!-- Интеграция легкой SVG-обложки -->
        \${svg_cover}

        <h1>\${h1}</h1>

        <!-- Блок Автора (E-E-A-T) -->
        <section class="author-box">
            <div style="margin-right: 20px; font-size: 3rem;">👤</div>
            <div>
                <strong>\${author_name}</strong> — <span>\${author_role}</span>
                <div style="font-size: 0.9em; opacity: 0.85; margin-top: 4px;">\${author_bio}</div>
                <div style="font-size: 0.75em; opacity: 0.6; margin-top: 6px;">Обновлено: \${pub_date}</div>
            </div>
        </section>

        <!-- Блок быстрого резюме (TL;DR) -->
        <section class="tldr-box">
            <strong>Коротко о главном (TL;DR):</strong>
            <ul>\${tldr_list}</ul>
        </section>

        <!-- Основное тело статьи -->
        <article class="article-content">
            \${content}
        </article>

        <!-- FAQ Блок (С поддержкой разметки «вопрос-ответ») -->
        <section class="faq-section">
            <h2>Часто задаваемые вопросы</h2>
            \${faq_html}
        </section>
    </main>

    <!-- Контекстная перелинковка (Увеличение PageRank внутренних страниц) -->
    <aside class="related-box">
        <h3>Рекомендуем к прочтению:</h3>
        <ul>\${related_links}</ul>
    </aside>

    <footer>
        <p>&copy; \${current_year} \${domain_name}. Материалы подготовлены авторитетными специалистами отрасли. Копирование материалов запрещено.</p>
    </footer>

    <!-- Скрипт защиты от копирования контента ручным выделением и хоткеями -->
    <script>
        document.addEventListener('contextmenu', e => e.preventDefault());
        document.addEventListener('keydown', e => {
            if (e.ctrlKey && (e.key === 'c' || e.key === 'u' || e.key === 's' || e.key === 'a')) {
                e.preventDefault();
            }
        });
    </script>
</body>
</html>
`;

// ==========================================
// 3. СВЯЗЬ С GOOGLE API (GEMINI-2.5-FLASH) И РЕТРАИ
// ==========================================
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function askGemini(promptText) {
    if (!GEMINI_API_KEY) {
        console.error("❌ Критическая ошибка: Переменная окружения GEMINI_API_KEY отсутствует!");
        process.exit(1);
    }
    
    // Использование актуальной модели gemini-2.5-flash
    const url = `https://generativetoolkit.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const payload = JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { responseMimeType: "application/json" }
    });

    // 5 попыток отправки запроса с экспоненциальной задержкой (Exponential Backoff)
    for (let attempt = 1; attempt <= 5; attempt++) {
        try {
            return await new Promise((resolve, reject) => {
                const req = https.request(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                }, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        if (res.statusCode === 200) {
                            try {
                                const parsed = JSON.parse(data);
                                resolve(JSON.parse(parsed.candidates[0].content.parts[0].text));
                            } catch (e) {
                                reject(new Error("Не удалось спарсить JSON-ответ от Gemini."));
                            }
                        } else {
                            reject(new Error(`API Error: ${res.statusCode} - ${data}`));
                        }
                    });
                });
                req.on('error', reject);
                req.write(payload);
                req.end();
            });
        } catch (error) {
            console.warn(`⚠️ Попытка ${attempt}/5 завершилась неудачей. Повторный запуск через некоторое время...`);
            if (attempt === 5) throw error;
            await delay(Math.pow(2, attempt) * 2000); // 4s, 8s, 16s, 32s
        }
    }
}

// Генерация валидных SVG обложек
function generateSVGCover(title, accentColor) {
    const escapedTitle = title.replace(/"/g, '&quot;');
    return `<svg class="cover-svg" viewBox="0 0 800 450" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:${accentColor};stop-opacity:0.25" />
                <stop offset="100%" style="stop-color:#1a202c;stop-opacity:0.95" />
            </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)" />
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="system-ui" font-size="32" font-weight="bold" width="700">
            ${escapedTitle}
        </text>
    </svg>`;
}

// Простой парсер Markdown в HTML
function markdownToHtml(md) {
    let html = md
        .replace(/\r\n/g, '\n')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/### (.*?)\n/g, '<h3>$1</h3>')
        .replace(/## (.*?)\n/g, '<h2>$1</h2>')
        // Отрендерим таблицы
        .replace(/\|([\s\S]*?)\|/g, (match) => {
            const lines = match.trim().split('\n');
            let tableHtml = '<table>';
            lines.forEach((line, index) => {
                if (line.includes('---')) return; // Пропуск разделителя
                const cols = line.split('|').filter(c => c.trim() !== '');
                tableHtml += '<tr>';
                cols.forEach(col => {
                    const tag = index === 0 ? 'th' : 'td';
                    tableHtml += `<${tag}>${col.trim()}</${tag}>`;
                });
                tableHtml += '</tr>';
            });
            tableHtml += '</table>';
            return tableHtml;
        })
        .replace(/\n\n/g, '</p><p>');
    
    return `<p>${html}</p>`.replace(/<p><h/g, '<h').replace(/<\/h(\d)><\/p>/g, '</h$1>');
}

// ==========================================
// 4. ОСНОВНОЙ ПРОЦЕСС СБОРКИ
// ==========================================
async function main() {
    console.log("🚀 Запуск процесса компиляции статических файлов...");
    
    let instructions = "По умолчанию";
    if (fs.existsSync(PROMPT_FILE)) {
        instructions = fs.readFileSync(PROMPT_FILE, 'utf-8').trim();
    }

    if (instructions !== "none" && instructions !== "") {
        console.log(`🤖 Отправляем задачу в gemini-2.5-flash: "${instructions}"`);
        
        const systemPrompt = `
        Ты - профессиональный SEO-архитектор и копирайтер. Разработай структуру контентного сайта под тематику: "${instructions}".
        Сгенерируй ровно 4 уникальные статьи на тему, полностью раскрывающие семантику.
        Для каждого языка ('ru', 'en') подготовь локализованные тексты, мета-описание, LSI-ключи и FAQ-блоки.
        Исключи любые вводные фразы: "в заключение", "стоит отметить", "таким образом". Пиши четко, структурировано.
        Верни ответ в СТРОГОМ формате JSON без разметки Markdown в начале и конце:
        {
          "accent_color": "#HEX_КОД_ЦВЕТА",
          "articles": [
            {
              "id": "slug-id-statyi-na-latinitse",
              "ru": {
                "title": "Заголовок статьи для вкладки браузера",
                "desc": "Мета-описание (description) до 160 символов.",
                "h1": "Главный видимый заголовок H1",
                "tldr": ["Важный инсайт 1", "Важный инсайт 2", "Важный инсайт 3"],
                "content_markdown": "Профессионально оформленная статья. Используй заголовки h2, h3, списки и обязательно одну таблицу.",
                "faq": [
                  {"q": "Вопрос 1?", "a": "Ответ на вопрос 1."},
                  {"q": "Вопрос 2?", "a": "Ответ на вопрос 2."}
                ],
                "author": {
                  "name": "Иван Смирнов",
                  "role": "Профильный эксперт",
                  "bio": "Практикующий специалист с опытом свыше 12 лет, автор десятков отраслевых публикаций."
                }
              },
              "en": {
                "title": "SEO Optimized Title in English",
                "desc": "Meta description in English up to 160 chars.",
                "h1": "Visible header H1 in English",
                "tldr": ["Key point 1", "Key point 2", "Key point 3"],
                "content_markdown": "Deep, contextually adapted English text with h2, h3, lists, and a comparison table.",
                "faq": [
                  {"q": "FAQ Question 1?", "a": "FAQ Answer 1."},
                  {"q": "FAQ Question 2?", "a": "FAQ Answer 2."}
                ],
                "author": {
                  "name": "John Smith",
                  "role": "Subject Matter Expert",
                  "bio": "Experienced lead specialist, writer and tech reviewer."
                }
              }
            }
          ]
        }
        `;
        
        try {
            const aiResponse = await askGemini(systemPrompt);
            cache.accent_color = aiResponse.accent_color || "#3182ce";
            cache.articles = cache.articles || [];
            
            aiResponse.articles.forEach(art => {
                const idx = cache.articles.findIndex(a => a.id === art.id);
                if (idx > -1) {
                    cache.articles[idx] = art; // Обновляем существующий кэш
                } else {
                    cache.articles.push(art);  // Добавляем новые элементы в кэш
                }
            });
            
            fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
            fs.writeFileSync(PROMPT_FILE, "none"); // Сбрасываем пульт в режим ожидания
            console.log("💾 Кэш успешно обновлен. Инструкции prompt.txt переведены в режим ожидания ('none').");
        } catch (e) {
            console.error("❌ Сбой ИИ-генерации. Продолжаем сборку на базе старого кэша...", e);
        }
    }

    if (!cache.articles || cache.articles.length === 0) {
        console.error("❌ Ошибка: В кэше нет доступных статей для выгрузки!");
        process.exit(1);
    }

    // Очистка и создание директорий рендера
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.mkdirSync(path.join(OUTPUT_DIR, 'ru'), { recursive: true });
    fs.mkdirSync(path.join(OUTPUT_DIR, 'en'), { recursive: true });

    const accentColor = cache.accent_color || "#3182ce";
    const todayStr = new Date().toLocaleDateString('ru-RU');
    const todayIso = new Date().toISOString().split('T')[0];
    const sitemapUrls = [];

    // Цикл генерации страниц
    for (const art of cache.articles) {
        for (const lang of ['ru', 'en']) {
            const data = art[lang];
            const artId = art.id;

            // Навигационное меню (Внутренние каноничные ссылки)
            const navLinks = cache.articles.map(a => {
                return `<a href="/${lang}/${a.id}/">${a[lang].title.split(" - ")[0]}</a>`;
            }).join(" ");

            // Переключатель языков
            const otherLang = lang === 'ru' ? 'en' : 'ru';
            const langSwitches = `<a href="/${otherLang}/${artId}/">${lang === 'ru' ? 'English' : 'Русский'}</a>`;

            // Теги hreflang
            const hreflangs = `
    <link rel="alternate" hreflang="ru" href="${SITE_URL}/ru/${artId}/" />
    <link rel="alternate" hreflang="en" href="${SITE_URL}/en/${artId}/" />
    <link rel="alternate" hreflang="x-default" href="${SITE_URL}/ru/${artId}/" />
            `;

            // Генерация списков TL;DR и FAQ
            const tldrList = data.tldr.map(t => `<li>${t}</li>`).join("");
            const faqHtml = data.faq.map(f => `
                <details class="faq-item">
                    <summary>${f.q}</summary>
                    <p>${f.a}</p>
                </details>
            `).join("");

            const faqSchemaJson = JSON.stringify(data.faq.map(f => ({
                "@type": "Question",
                "name": f.q,
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": f.a
                }
            })));

            // Рендер контента из markdown
            let contentHtml = markdownToHtml(data.content_markdown);

            // Умная перелинковка (Увеличение внутреннего PageRank)
            cache.articles.forEach(target => {
                if (target.id !== artId) {
                    const wordToLink = target[lang].title.split(" ")[0]; // Берем корень первого слова заголовка
                    if (wordToLink.length > 4) {
                        const regex = new RegExp(`\\b(${wordToLink}[а-яa-z]*)\\b`, 'gi');
                        contentHtml = contentHtml.replace(regex, `<a href="/${lang}/${target.id}/">$1</a>`);
                    }
                }
            });

            // Список страниц для автоматического предренда в фоне через браузер пользователя
            const specUrls = JSON.stringify(cache.articles.map(a => `/${lang}/${a.id}/`));

            // Формирование блока рекомендуемых статей
            const relatedLinks = cache.articles
                .filter(a => a.id !== artId)
                .map(a => `<li><a href="/${lang}/${a.id}/">${a[lang].title}</a></li>`)
                .join("");

            const svgCover = generateSVGCover(data.title, accentColor);

            // Сборка конечного HTML
            const resultHtml = HTML_TEMPLATE
                .replace(/\${lang}/g, lang)
                .replace(/\${meta_title}/g, data.title)
                .replace(/\${meta_desc}/g, data.desc)
                .replace(/\${hreflangs}/g, hreflangs)
                .replace(/\${accent_color}/g, accentColor)
                .replace(/\${speculation_urls}/g, specUrls)
                .replace(/\${nav_links}/g, navLinks)
                .replace(/\${lang_switches}/g, langSwitches)
                .replace(/\${svg_cover}/g, svgCover)
                .replace(/\${h1}/g, data.h1)
                .replace(/\${art_id}/g, artId)
                .replace(/\${author_name}/g, data.author.name)
                .replace(/\${author_role}/g, data.author.role)
                .replace(/\${author_bio}/g, data.author.bio)
                .replace(/\${pub_date}/g, todayStr)
                .replace(/\${pub_date_iso}/g, todayIso)
                .replace(/\${tldr_list}/g, tldrList)
                .replace(/\${content}/g, contentHtml)
                .replace(/\${faq_html}/g, faqHtml)
                .replace(/\${faq_schema_json}/g, faqSchemaJson)
                .replace(/\${related_links}/g, relatedLinks)
                .replace(/\${current_year}/g, new Date().getFullYear())
                .replace(/\${site_url}/g, SITE_URL)
                .replace(/\${domain_name}/g, SITE_URL.replace(/https?:\/\//, ""));

            // Публикация страницы по ЧПУ в формате /lang/slug/index.html
            const pageDir = path.join(OUTPUT_DIR, lang, artId);
            fs.mkdirSync(pageDir, { recursive: true });
            fs.writeFileSync(path.join(pageDir, 'index.html'), resultHtml);

            sitemapUrls.push(`${SITE_URL}/${lang}/${artId}/`);
        }
    }

    // Редирект с корня на основе языковых предпочтений браузера
    const homeRedirect = `<!DOCTYPE html>
    <html>
    <head>
        <script>
            var userLang = navigator.language || navigator.userLanguage;
            if (userLang.indexOf('ru') !== -1) {
                window.location.href = '/ru/${cache.articles[0].id}/';
            } else {
                window.location.href = '/en/${cache.articles[0].id}/';
            }
        </script>
    </head>
    <body></body>
    </html>`;
    fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), homeRedirect);

    // Сборка sitemap.xml
    const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        ${sitemapUrls.map(url => `
        <url>
            <loc>${url}</loc>
            <lastmod>${todayIso}</lastmod>
            <changefreq>weekly</changefreq>
            <priority>0.8</priority>
        </url>`).join("")}
    </urlset>`;
    fs.writeFileSync(path.join(OUTPUT_DIR, 'sitemap.xml'), sitemapContent);

    // Сборка robots.txt: Блокировка краулеров ИИ при сохранении видимости в ИИ-выдаче (поиск)
    const robotsContent = `User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: Applebot-Extended
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: Meta-ExternalAgent
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: cohere-ai
Disallow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml`;
    fs.writeFileSync(path.join(OUTPUT_DIR, 'robots.txt'), robotsContent);

    console.log("🎉 Все файлы успешно собраны и укомплектованы в каталог ./dist!");
}

main().catch(err => {
    console.error("❌ Ошибка в ходе сборки сайта:", err);
    process.exit(1);
});

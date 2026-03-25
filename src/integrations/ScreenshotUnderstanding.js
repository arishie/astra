/**
 * ScreenshotUnderstanding - AI Vision for Screenshots
 *
 * VIRAL FEATURE: Send any screenshot to your WhatsApp/Telegram bot,
 * Astra understands it and helps you.
 *
 * Examples:
 * - Screenshot of error message → Explains error and suggests fix
 * - Screenshot of email → Summarizes and drafts reply
 * - Screenshot of receipt → Extracts info for expense tracking
 * - Screenshot of code → Explains, debugs, or improves it
 * - Screenshot of schedule → Converts to calendar events
 * - Screenshot of product → Finds best price online
 * - Screenshot of food → Estimates calories and nutrition
 * - Screenshot of plant → Identifies species and care tips
 * - Screenshot of math problem → Solves it step by step
 * - Screenshot of foreign text → Translates it
 */
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
// ============================================================================
// Screenshot Understanding Engine
// ============================================================================
export class ScreenshotUnderstanding extends EventEmitter {
    openaiApiKey;
    anthropicApiKey;
    googleApiKey;
    constructor(options = {}) {
        super();
        this.openaiApiKey = options.openaiApiKey || process.env.OPENAI_API_KEY;
        this.anthropicApiKey = options.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
        this.googleApiKey = options.googleApiKey || process.env.GOOGLE_AI_API_KEY;
    }
    /**
     * Analyze a screenshot and provide intelligent response
     */
    async analyze(screenshot) {
        console.log(`[ScreenshotUnderstanding] Analyzing screenshot ${screenshot.id}...`);
        // Read image and convert to base64
        const imageBuffer = fs.readFileSync(screenshot.imagePath);
        const base64Image = imageBuffer.toString('base64');
        const mimeType = screenshot.mimeType || 'image/png';
        // Analyze with vision model
        const analysis = await this.analyzeWithVision(base64Image, mimeType, screenshot.caption);
        this.emit('analyzed', { screenshot, analysis });
        // Generate contextual response
        const response = this.generateResponse(analysis);
        return {
            analysis,
            response: response.message,
            actions: response.actions
        };
    }
    /**
     * Call vision model to analyze image
     */
    async analyzeWithVision(base64Image, mimeType, caption) {
        const prompt = `Analyze this screenshot and provide:
1. What type of content is shown (error_message, code, email, receipt, schedule, product, food, document, social_media, chat, map, math, foreign_text, plant, ui_screen, or other)
2. A brief description of what's shown
3. Any text visible in the image
4. Key entities (dates, prices, emails, phone numbers, products, people names, etc.)
5. Suggested helpful actions the user might want to take

${caption ? `User's message about this image: "${caption}"` : ''}

Respond in JSON format:
{
  "type": "...",
  "description": "...",
  "extractedText": "...",
  "entities": { ... },
  "suggestedActions": [{ "label": "...", "action": "...", "data": {...}, "priority": 1 }]
}`;
        if (this.openaiApiKey) {
            return this.analyzeWithOpenAI(base64Image, mimeType, prompt);
        }
        else if (this.anthropicApiKey) {
            return this.analyzeWithAnthropic(base64Image, mimeType, prompt);
        }
        else {
            throw new Error('No vision API configured. Add OPENAI_API_KEY or ANTHROPIC_API_KEY.');
        }
    }
    /**
     * Analyze with OpenAI GPT-4 Vision
     */
    async analyzeWithOpenAI(base64Image, mimeType, prompt) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.openaiApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: prompt },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:${mimeType};base64,${base64Image}`
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 1000
            })
        });
        if (!response.ok) {
            throw new Error(`OpenAI Vision API error: ${response.statusText}`);
        }
        const data = await response.json();
        const content = data.choices[0]?.message?.content || '{}';
        try {
            // Extract JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    type: parsed.type || 'other',
                    confidence: 0.9,
                    description: parsed.description || '',
                    extractedText: parsed.extractedText,
                    entities: parsed.entities || {},
                    suggestedActions: parsed.suggestedActions || []
                };
            }
        }
        catch (e) {
            console.warn('[ScreenshotUnderstanding] Failed to parse JSON response');
        }
        return {
            type: 'other',
            confidence: 0.5,
            description: content,
            entities: {},
            suggestedActions: []
        };
    }
    /**
     * Analyze with Anthropic Claude Vision
     */
    async analyzeWithAnthropic(base64Image, mimeType, prompt) {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': this.anthropicApiKey,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 1000,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: mimeType,
                                    data: base64Image
                                }
                            },
                            { type: 'text', text: prompt }
                        ]
                    }
                ]
            })
        });
        if (!response.ok) {
            throw new Error(`Anthropic Vision API error: ${response.statusText}`);
        }
        const data = await response.json();
        const content = data.content[0]?.text || '{}';
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    type: parsed.type || 'other',
                    confidence: 0.9,
                    description: parsed.description || '',
                    extractedText: parsed.extractedText,
                    entities: parsed.entities || {},
                    suggestedActions: parsed.suggestedActions || []
                };
            }
        }
        catch (e) {
            console.warn('[ScreenshotUnderstanding] Failed to parse JSON response');
        }
        return {
            type: 'other',
            confidence: 0.5,
            description: content,
            entities: {},
            suggestedActions: []
        };
    }
    /**
     * Generate user-friendly response based on analysis
     */
    generateResponse(analysis) {
        const { type, description, extractedText, entities, suggestedActions } = analysis;
        let message = '';
        let actions = suggestedActions;
        switch (type) {
            case 'error_message':
                message = `I see an error message:\n\n"${extractedText || description}"\n\n`;
                message += `This typically means: ${this.explainError(extractedText || description)}\n\n`;
                message += `Would you like me to help you fix it?`;
                actions = [
                    { label: 'Explain in detail', action: 'explain_error', data: { text: extractedText }, priority: 1 },
                    { label: 'Search for solutions', action: 'search_solutions', data: { error: extractedText }, priority: 2 },
                    ...suggestedActions
                ];
                break;
            case 'code':
                const codeEntity = entities.code?.[0];
                message = `I see ${codeEntity?.language || 'some'} code.\n\n`;
                message += `${description}\n\n`;
                message += `What would you like me to do with it?`;
                actions = [
                    { label: 'Explain this code', action: 'explain_code', data: { code: extractedText }, priority: 1 },
                    { label: 'Find bugs', action: 'debug_code', data: { code: extractedText }, priority: 2 },
                    { label: 'Improve it', action: 'improve_code', data: { code: extractedText }, priority: 3 },
                    ...suggestedActions
                ];
                break;
            case 'email':
                message = `I see an email:\n\n`;
                if (entities.people?.length) {
                    message += `From: ${entities.people[0]}\n`;
                }
                message += `\n${description}\n\n`;
                message += `Would you like me to help you respond?`;
                actions = [
                    { label: 'Draft a reply', action: 'draft_reply', data: { context: description }, priority: 1 },
                    { label: 'Summarize key points', action: 'summarize', data: { text: extractedText }, priority: 2 },
                    ...suggestedActions
                ];
                break;
            case 'receipt':
                const prices = entities.prices || [];
                const total = prices.length > 0 ? prices[prices.length - 1] : null;
                message = `I see a receipt.\n\n`;
                if (total) {
                    message += `Total: ${total.currency}${total.amount}\n`;
                }
                if (entities.dates?.length) {
                    message += `Date: ${entities.dates[0].toLocaleDateString()}\n`;
                }
                message += `\n${description}\n\n`;
                message += `Would you like me to log this expense?`;
                actions = [
                    { label: 'Log expense', action: 'log_expense', data: { amount: total, date: entities.dates?.[0] }, priority: 1 },
                    { label: 'Add to spreadsheet', action: 'add_to_sheet', data: { receipt: entities }, priority: 2 },
                    ...suggestedActions
                ];
                break;
            case 'schedule':
                message = `I see a schedule/calendar.\n\n${description}\n\n`;
                if (entities.dates?.length) {
                    message += `Events detected for: ${entities.dates.map(d => d.toLocaleDateString()).join(', ')}\n\n`;
                }
                message += `Would you like me to add these to your calendar?`;
                actions = [
                    { label: 'Add to my calendar', action: 'add_to_calendar', data: { events: entities }, priority: 1 },
                    { label: 'Set reminders', action: 'set_reminders', data: { dates: entities.dates }, priority: 2 },
                    ...suggestedActions
                ];
                break;
            case 'product':
                const products = entities.products || [];
                message = `I see a product:\n\n`;
                if (products.length > 0) {
                    message += `${products[0].name}`;
                    if (products[0].price)
                        message += ` - ${products[0].price}`;
                    message += `\n`;
                }
                message += `\n${description}\n\n`;
                message += `Want me to find the best price?`;
                actions = [
                    { label: 'Find best price', action: 'price_compare', data: { product: products[0] }, priority: 1 },
                    { label: 'Read reviews', action: 'find_reviews', data: { product: products[0] }, priority: 2 },
                    { label: 'Add to wishlist', action: 'add_wishlist', data: { product: products[0] }, priority: 3 },
                    ...suggestedActions
                ];
                break;
            case 'food':
                message = `I see food!\n\n${description}\n\n`;
                message += `Would you like nutritional information?`;
                actions = [
                    { label: 'Estimate calories', action: 'estimate_nutrition', data: { food: description }, priority: 1 },
                    { label: 'Find recipe', action: 'find_recipe', data: { food: description }, priority: 2 },
                    { label: 'Log meal', action: 'log_meal', data: { food: description }, priority: 3 },
                    ...suggestedActions
                ];
                break;
            case 'math':
                message = `I see a math problem.\n\n${description}\n\n`;
                message += `Let me solve it for you...`;
                actions = [
                    { label: 'Solve step by step', action: 'solve_math', data: { problem: extractedText }, priority: 1 },
                    { label: 'Explain concept', action: 'explain_math', data: { problem: extractedText }, priority: 2 },
                    ...suggestedActions
                ];
                break;
            case 'foreign_text':
                message = `I see text in another language.\n\n`;
                message += `"${extractedText}"\n\n`;
                message += `Would you like me to translate it?`;
                actions = [
                    { label: 'Translate to English', action: 'translate', data: { text: extractedText, to: 'en' }, priority: 1 },
                    { label: 'Pronounce it', action: 'pronounce', data: { text: extractedText }, priority: 2 },
                    ...suggestedActions
                ];
                break;
            case 'plant':
                message = `I see a plant!\n\n${description}\n\n`;
                message += `Would you like care tips?`;
                actions = [
                    { label: 'Care instructions', action: 'plant_care', data: { plant: description }, priority: 1 },
                    { label: 'Is it toxic to pets?', action: 'plant_toxicity', data: { plant: description }, priority: 2 },
                    ...suggestedActions
                ];
                break;
            default:
                message = `${description}\n\n`;
                if (extractedText) {
                    message += `Text found: "${extractedText.substring(0, 200)}${extractedText.length > 200 ? '...' : ''}"\n\n`;
                }
                message += `How can I help you with this?`;
                actions = suggestedActions.length > 0 ? suggestedActions : [
                    { label: 'Extract text', action: 'extract_text', data: { image: true }, priority: 1 },
                    { label: 'Summarize', action: 'summarize', data: { content: description }, priority: 2 },
                    { label: 'Search related', action: 'search', data: { query: description }, priority: 3 }
                ];
        }
        return { message, actions };
    }
    /**
     * Explain common error messages
     */
    explainError(errorText) {
        const lower = errorText.toLowerCase();
        if (lower.includes('404')) {
            return 'The page or resource was not found.';
        }
        if (lower.includes('500')) {
            return 'There\'s a server-side error. The website might be having issues.';
        }
        if (lower.includes('permission') || lower.includes('access denied')) {
            return 'You don\'t have permission to access this.';
        }
        if (lower.includes('timeout')) {
            return 'The request took too long. Try again or check your connection.';
        }
        if (lower.includes('network') || lower.includes('connection')) {
            return 'There\'s a network connectivity issue.';
        }
        if (lower.includes('null') || lower.includes('undefined')) {
            return 'A programming error - something is missing that shouldn\'t be.';
        }
        if (lower.includes('syntax')) {
            return 'There\'s a typo or formatting error in the code.';
        }
        return 'This indicates something went wrong. Let me help you understand it better.';
    }
}
// ============================================================================
// Export
// ============================================================================
export default ScreenshotUnderstanding;
//# sourceMappingURL=ScreenshotUnderstanding.js.map
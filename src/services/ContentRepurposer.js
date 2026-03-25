// @ts-nocheck
import { EventEmitter } from 'events';
import * as crypto from 'crypto';
// ============================================================================
// Platform Constraints Configuration
// ============================================================================
const PLATFORM_CONSTRAINTS = {
    twitter: {
        maxTextLength: 280,
        maxHashtags: 5,
        maxMentions: 10,
        supportedMediaTypes: ['image', 'video', 'gif'],
        maxMediaCount: 4,
        mediaAspectRatios: [
            { name: 'landscape', width: 16, height: 9, recommended: true },
            { name: 'square', width: 1, height: 1 },
            { name: 'portrait', width: 4, height: 5 },
        ],
        maxVideoLength: 140,
        maxImageSize: 5 * 1024 * 1024,
        maxVideoSize: 512 * 1024 * 1024,
        linkShortening: true,
        supportsThreads: true,
    },
    instagram: {
        maxTextLength: 2200,
        maxHashtags: 30,
        maxMentions: 20,
        supportedMediaTypes: ['image', 'video', 'carousel'],
        maxMediaCount: 10,
        mediaAspectRatios: [
            { name: 'square', width: 1, height: 1, recommended: true },
            { name: 'portrait', width: 4, height: 5 },
            { name: 'landscape', width: 1.91, height: 1 },
        ],
        maxVideoLength: 60,
        maxImageSize: 8 * 1024 * 1024,
        maxVideoSize: 100 * 1024 * 1024,
        supportsCarousel: true,
        requiresAltText: true,
    },
    linkedin: {
        maxTextLength: 3000,
        maxHashtags: 5,
        maxMentions: 30,
        supportedMediaTypes: ['image', 'video', 'carousel'],
        maxMediaCount: 9,
        mediaAspectRatios: [
            { name: 'landscape', width: 1.91, height: 1, recommended: true },
            { name: 'square', width: 1, height: 1 },
            { name: 'portrait', width: 4, height: 5 },
        ],
        maxVideoLength: 600,
        maxImageSize: 10 * 1024 * 1024,
        maxVideoSize: 200 * 1024 * 1024,
        supportsCarousel: true,
    },
    tiktok: {
        maxTextLength: 2200,
        maxHashtags: 10,
        maxMentions: 5,
        supportedMediaTypes: ['video'],
        maxMediaCount: 1,
        mediaAspectRatios: [
            { name: 'vertical', width: 9, height: 16, recommended: true },
        ],
        maxVideoLength: 600,
        maxVideoSize: 287 * 1024 * 1024,
    },
    youtube: {
        maxTextLength: 5000,
        maxHashtags: 15,
        maxMentions: 50,
        supportedMediaTypes: ['video'],
        maxMediaCount: 1,
        mediaAspectRatios: [
            { name: 'landscape', width: 16, height: 9, recommended: true },
        ],
        maxVideoLength: 43200, // 12 hours
        maxVideoSize: 256 * 1024 * 1024 * 1024, // 256GB
    },
    blog: {
        maxTextLength: 100000,
        maxHashtags: 20,
        maxMentions: 100,
        supportedMediaTypes: ['image', 'video', 'gif'],
        maxMediaCount: 50,
        mediaAspectRatios: [
            { name: 'landscape', width: 16, height: 9, recommended: true },
            { name: 'wide', width: 21, height: 9 },
            { name: 'square', width: 1, height: 1 },
        ],
    },
    email: {
        maxTextLength: 50000,
        maxHashtags: 0,
        maxMentions: 50,
        supportedMediaTypes: ['image', 'gif'],
        maxMediaCount: 10,
        mediaAspectRatios: [
            { name: 'email_header', width: 600, height: 200, recommended: true },
            { name: 'square', width: 1, height: 1 },
        ],
        maxImageSize: 1 * 1024 * 1024,
        characterEncoding: 'utf-8',
    },
    threads: {
        maxTextLength: 500,
        maxHashtags: 5,
        maxMentions: 10,
        supportedMediaTypes: ['image', 'video', 'gif', 'carousel'],
        maxMediaCount: 10,
        mediaAspectRatios: [
            { name: 'square', width: 1, height: 1, recommended: true },
            { name: 'portrait', width: 4, height: 5 },
        ],
        maxVideoLength: 300,
        supportsCarousel: true,
    },
    facebook: {
        maxTextLength: 63206,
        maxHashtags: 10,
        maxMentions: 50,
        supportedMediaTypes: ['image', 'video', 'gif', 'carousel'],
        maxMediaCount: 10,
        mediaAspectRatios: [
            { name: 'landscape', width: 16, height: 9, recommended: true },
            { name: 'square', width: 1, height: 1 },
            { name: 'portrait', width: 4, height: 5 },
        ],
        maxVideoLength: 14400, // 4 hours
        maxImageSize: 10 * 1024 * 1024,
        maxVideoSize: 4 * 1024 * 1024 * 1024, // 4GB
        supportsCarousel: true,
    },
    pinterest: {
        maxTextLength: 500,
        maxHashtags: 20,
        maxMentions: 0,
        supportedMediaTypes: ['image', 'video'],
        maxMediaCount: 5,
        mediaAspectRatios: [
            { name: 'pinterest_optimal', width: 2, height: 3, recommended: true },
            { name: 'square', width: 1, height: 1 },
        ],
        maxVideoLength: 900,
        maxImageSize: 32 * 1024 * 1024,
    },
};
// ============================================================================
// Tone Adjuster
// ============================================================================
export class ToneAdjuster {
    tonePatterns;
    constructor() {
        this.tonePatterns = new Map();
        this.initializeTonePatterns();
    }
    initializeTonePatterns() {
        this.tonePatterns.set('professional', {
            sentenceStarters: [
                'We are pleased to',
                'Our team has',
                'Introducing',
                'We are excited to announce',
                'Discover how',
            ],
            avoidWords: ['awesome', 'cool', 'totally', 'literally', 'basically'],
            preferredWords: [
                'innovative', 'strategic', 'comprehensive', 'efficient', 'optimize',
            ],
            emojiUsage: 'minimal',
            formalityLevel: 0.9,
        });
        this.tonePatterns.set('casual', {
            sentenceStarters: [
                'Hey!', 'Check this out', 'So excited to', 'Just dropped', 'You know what?',
            ],
            avoidWords: ['pursuant', 'heretofore', 'aforementioned', 'notwithstanding'],
            preferredWords: ['awesome', 'cool', 'amazing', 'great', 'love'],
            emojiUsage: 'frequent',
            formalityLevel: 0.2,
        });
        this.tonePatterns.set('witty', {
            sentenceStarters: [
                'Plot twist:', 'Hot take:', 'Unpopular opinion:', 'Not to brag, but',
            ],
            avoidWords: ['boring', 'normal', 'regular', 'typical'],
            preferredWords: ['cleverly', 'hilariously', 'ingeniously', 'surprisingly'],
            emojiUsage: 'moderate',
            formalityLevel: 0.4,
        });
        this.tonePatterns.set('inspirational', {
            sentenceStarters: [
                'Believe in', 'Your journey', 'Together we can', 'Dream big',
                'The path to success',
            ],
            avoidWords: ['fail', 'impossible', 'never', 'cannot', 'weak'],
            preferredWords: [
                'empower', 'transform', 'achieve', 'inspire', 'breakthrough', 'overcome',
            ],
            emojiUsage: 'moderate',
            formalityLevel: 0.5,
        });
        this.tonePatterns.set('educational', {
            sentenceStarters: [
                'Did you know', 'Here\'s how', 'Learn about', 'Understanding',
                'The science behind', 'Key takeaways:',
            ],
            avoidWords: ['obviously', 'simply', 'just'],
            preferredWords: [
                'discover', 'explore', 'understand', 'learn', 'research', 'evidence',
            ],
            emojiUsage: 'minimal',
            formalityLevel: 0.7,
        });
        this.tonePatterns.set('promotional', {
            sentenceStarters: [
                'Introducing', 'Don\'t miss', 'Limited time', 'Exclusive offer',
                'Transform your', 'Get yours now',
            ],
            avoidWords: ['maybe', 'possibly', 'might', 'could'],
            preferredWords: [
                'exclusive', 'premium', 'guaranteed', 'revolutionary', 'must-have',
            ],
            emojiUsage: 'frequent',
            formalityLevel: 0.5,
        });
        this.tonePatterns.set('conversational', {
            sentenceStarters: [
                'So here\'s the thing', 'Let me tell you', 'I was thinking',
                'Have you ever', 'Here\'s my take',
            ],
            avoidWords: ['one should', 'it is necessary', 'one must'],
            preferredWords: ['think', 'feel', 'love', 'wonder', 'curious'],
            emojiUsage: 'moderate',
            formalityLevel: 0.3,
        });
        this.tonePatterns.set('formal', {
            sentenceStarters: [
                'We would like to inform', 'It is our pleasure', 'Please be advised',
                'We are writing to', 'In accordance with',
            ],
            avoidWords: ['gonna', 'wanna', 'kinda', 'sorta', 'yeah'],
            preferredWords: [
                'regarding', 'accordingly', 'subsequently', 'therefore', 'furthermore',
            ],
            emojiUsage: 'none',
            formalityLevel: 1.0,
        });
        this.tonePatterns.set('humorous', {
            sentenceStarters: [
                'No one:', 'Me:', 'Breaking news:', 'Spoiler alert:',
                'In today\'s episode of',
            ],
            avoidWords: ['seriously', 'importantly', 'significantly'],
            preferredWords: ['hilariously', 'ridiculously', 'absurdly', 'awkwardly'],
            emojiUsage: 'frequent',
            formalityLevel: 0.1,
        });
    }
    adjustTone(text, targetTone, platform) {
        const pattern = this.tonePatterns.get(targetTone);
        if (!pattern) {
            return {
                adjustedText: text,
                originalTone: this.detectTone(text),
                targetTone,
                adjustments: [],
                confidence: 0,
            };
        }
        let adjustedText = text;
        const adjustments = [];
        // Replace avoided words
        for (const word of pattern.avoidWords) {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            if (regex.test(adjustedText)) {
                const replacement = this.findReplacement(word, pattern.preferredWords);
                if (replacement) {
                    adjustedText = adjustedText.replace(regex, replacement);
                    adjustments.push(`Replaced "${word}" with "${replacement}"`);
                }
            }
        }
        // Adjust emoji usage based on pattern
        adjustedText = this.adjustEmojis(adjustedText, pattern.emojiUsage);
        if (adjustedText !== text) {
            adjustments.push(`Adjusted emoji usage to ${pattern.emojiUsage}`);
        }
        // Platform-specific adjustments
        adjustedText = this.applyPlatformToneRules(adjustedText, targetTone, platform);
        return {
            adjustedText,
            originalTone: this.detectTone(text),
            targetTone,
            adjustments,
            confidence: this.calculateToneConfidence(adjustedText, targetTone),
        };
    }
    detectTone(text) {
        const scores = new Map();
        for (const [tone, pattern] of this.tonePatterns) {
            let score = 0;
            // Check for preferred words
            for (const word of pattern.preferredWords) {
                const regex = new RegExp(`\\b${word}\\b`, 'gi');
                const matches = text.match(regex);
                score += (matches?.length || 0) * 2;
            }
            // Penalize for avoided words
            for (const word of pattern.avoidWords) {
                const regex = new RegExp(`\\b${word}\\b`, 'gi');
                const matches = text.match(regex);
                score -= (matches?.length || 0) * 1.5;
            }
            // Check emoji density
            const emojiCount = (text.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
            const emojiDensity = emojiCount / (text.length / 100);
            if (pattern.emojiUsage === 'none' && emojiCount === 0)
                score += 2;
            if (pattern.emojiUsage === 'minimal' && emojiDensity < 1)
                score += 1;
            if (pattern.emojiUsage === 'moderate' && emojiDensity >= 1 && emojiDensity < 3)
                score += 1;
            if (pattern.emojiUsage === 'frequent' && emojiDensity >= 3)
                score += 2;
            scores.set(tone, score);
        }
        let maxTone = 'conversational';
        let maxScore = -Infinity;
        for (const [tone, score] of scores) {
            if (score > maxScore) {
                maxScore = score;
                maxTone = tone;
            }
        }
        return maxTone;
    }
    findReplacement(word, preferredWords) {
        // Simple word class matching - in production, use NLP
        const wordClasses = {
            positive: ['awesome', 'cool', 'great', 'amazing', 'excellent', 'outstanding'],
            formal: ['innovative', 'strategic', 'comprehensive', 'efficient', 'optimal'],
            casual: ['awesome', 'cool', 'amazing', 'fantastic', 'incredible'],
        };
        for (const [, words] of Object.entries(wordClasses)) {
            if (words.includes(word.toLowerCase())) {
                const available = preferredWords.filter(w => words.includes(w.toLowerCase()) || wordClasses.positive.includes(w.toLowerCase()));
                if (available.length > 0) {
                    return available[Math.floor(Math.random() * available.length)];
                }
            }
        }
        return preferredWords.length > 0 ? preferredWords[0] : null;
    }
    adjustEmojis(text, usage) {
        const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
        const emojis = text.match(emojiRegex) || [];
        if (usage === 'none') {
            return text.replace(emojiRegex, '').replace(/\s{2,}/g, ' ').trim();
        }
        if (usage === 'minimal' && emojis.length > 2) {
            let count = 0;
            return text.replace(emojiRegex, (match) => {
                count++;
                return count <= 2 ? match : '';
            }).replace(/\s{2,}/g, ' ').trim();
        }
        return text;
    }
    applyPlatformToneRules(text, tone, platform) {
        // Platform-specific tone adjustments
        if (platform === 'linkedin' && tone !== 'professional' && tone !== 'educational') {
            // LinkedIn benefits from slightly more professional tone
            text = text.replace(/!{2,}/g, '!');
            text = text.replace(/\.\.\./g, '.');
        }
        if (platform === 'twitter') {
            // Twitter: be more concise
            text = text.replace(/\s+/g, ' ').trim();
        }
        if (platform === 'tiktok' || platform === 'instagram') {
            // These platforms are more casual
            if (tone === 'formal' || tone === 'professional') {
                text = text.replace(/\bRegarding\b/gi, 'About');
                text = text.replace(/\bFurthermore\b/gi, 'Plus');
            }
        }
        return text;
    }
    calculateToneConfidence(text, targetTone) {
        const detectedTone = this.detectTone(text);
        if (detectedTone === targetTone) {
            return 0.9;
        }
        const pattern = this.tonePatterns.get(targetTone);
        if (!pattern)
            return 0.5;
        let matchCount = 0;
        for (const word of pattern.preferredWords) {
            if (new RegExp(`\\b${word}\\b`, 'gi').test(text)) {
                matchCount++;
            }
        }
        return Math.min(0.9, 0.5 + (matchCount * 0.1));
    }
}
// ============================================================================
// Hashtag Generator
// ============================================================================
export class HashtagGenerator {
    trendingHashtags;
    industryHashtags;
    constructor() {
        this.trendingHashtags = new Map();
        this.industryHashtags = new Map();
        this.initializeIndustryHashtags();
    }
    initializeIndustryHashtags() {
        this.industryHashtags.set('technology', [
            'tech', 'innovation', 'ai', 'machinelearning', 'coding',
            'software', 'startup', 'programming', 'developer', 'digital',
        ]);
        this.industryHashtags.set('marketing', [
            'marketing', 'digitalmarketing', 'socialmedia', 'branding',
            'contentmarketing', 'seo', 'growthhacking', 'advertising',
        ]);
        this.industryHashtags.set('business', [
            'business', 'entrepreneur', 'leadership', 'success', 'motivation',
            'networking', 'businesstips', 'smallbusiness', 'startup',
        ]);
        this.industryHashtags.set('lifestyle', [
            'lifestyle', 'wellness', 'health', 'fitness', 'mindfulness',
            'selfcare', 'motivation', 'inspiration', 'goals',
        ]);
        this.industryHashtags.set('fashion', [
            'fashion', 'style', 'ootd', 'fashionista', 'streetstyle',
            'trendy', 'lookoftheday', 'fashionblogger', 'instafashion',
        ]);
        this.industryHashtags.set('food', [
            'food', 'foodie', 'foodporn', 'instafood', 'yummy',
            'delicious', 'cooking', 'recipe', 'homemade', 'foodlover',
        ]);
    }
    async generate(content, platform, options = {}) {
        const constraints = PLATFORM_CONSTRAINTS[platform];
        const maxHashtags = options.maxCount ?? constraints.maxHashtags;
        if (maxHashtags === 0) {
            return {
                hashtags: [],
                relevanceScores: new Map(),
                categories: [],
            };
        }
        const extractedKeywords = this.extractKeywords(content);
        const detectedIndustries = this.detectIndustries(content);
        const hashtags = [];
        const relevanceScores = new Map();
        // Add keyword-based hashtags
        for (const keyword of extractedKeywords.slice(0, Math.floor(maxHashtags / 2))) {
            const hashtag = this.formatHashtag(keyword.word);
            if (this.isValidHashtag(hashtag, platform)) {
                hashtags.push(hashtag);
                relevanceScores.set(hashtag, keyword.score);
            }
        }
        // Add industry-specific hashtags
        for (const industry of detectedIndustries) {
            const industryTags = this.industryHashtags.get(industry) || [];
            for (const tag of industryTags) {
                if (hashtags.length >= maxHashtags)
                    break;
                const hashtag = `#${tag}`;
                if (!hashtags.includes(hashtag) && this.isValidHashtag(hashtag, platform)) {
                    hashtags.push(hashtag);
                    relevanceScores.set(hashtag, 0.7);
                }
            }
        }
        // Add platform-specific popular hashtags
        const platformTags = this.getPlatformSpecificHashtags(platform);
        for (const tag of platformTags) {
            if (hashtags.length >= maxHashtags)
                break;
            if (!hashtags.includes(tag)) {
                hashtags.push(tag);
                relevanceScores.set(tag, 0.5);
            }
        }
        // Add existing hashtags if preserve option is set
        if (options.preserveExisting) {
            const existingHashtags = content.match(/#\w+/g) || [];
            for (const tag of existingHashtags) {
                if (!hashtags.includes(tag) && hashtags.length < maxHashtags) {
                    hashtags.push(tag);
                    relevanceScores.set(tag, 0.8);
                }
            }
        }
        return {
            hashtags: hashtags.slice(0, maxHashtags),
            relevanceScores,
            categories: detectedIndustries,
        };
    }
    extractKeywords(content) {
        // Remove existing hashtags, mentions, URLs
        const cleanContent = content
            .replace(/#\w+/g, '')
            .replace(/@\w+/g, '')
            .replace(/https?:\/\/\S+/g, '')
            .toLowerCase();
        // Stop words to exclude
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
            'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
            'could', 'should', 'may', 'might', 'must', 'this', 'that', 'these',
            'those', 'it', 'its', 'you', 'your', 'we', 'our', 'they', 'their',
            'i', 'me', 'my', 'he', 'she', 'him', 'her', 'his', 'just', 'more',
            'so', 'than', 'too', 'very', 'can', 'get', 'got', 'about', 'into',
        ]);
        const words = cleanContent.match(/\b[a-z]{3,}\b/g) || [];
        const wordFreq = new Map();
        for (const word of words) {
            if (!stopWords.has(word)) {
                wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
            }
        }
        return Array.from(wordFreq.entries())
            .map(([word, freq]) => ({
            word,
            score: Math.min(1, freq * 0.3 + (word.length > 5 ? 0.2 : 0)),
        }))
            .sort((a, b) => b.score - a.score);
    }
    detectIndustries(content) {
        const industries = [];
        const lowerContent = content.toLowerCase();
        for (const [industry, keywords] of this.industryHashtags) {
            let matchCount = 0;
            for (const keyword of keywords) {
                if (lowerContent.includes(keyword)) {
                    matchCount++;
                }
            }
            if (matchCount >= 2) {
                industries.push(industry);
            }
        }
        return industries;
    }
    formatHashtag(word) {
        // CamelCase for multi-word or just lowercase
        const formatted = word
            .replace(/[^a-zA-Z0-9]/g, '')
            .toLowerCase();
        return `#${formatted}`;
    }
    isValidHashtag(hashtag, platform) {
        // Basic validation
        if (hashtag.length < 2 || hashtag.length > 100)
            return false;
        if (!/^#[a-zA-Z0-9_]+$/.test(hashtag))
            return false;
        // Platform-specific rules
        if (platform === 'linkedin') {
            // LinkedIn prefers professional hashtags
            const casualTags = ['lol', 'omg', 'wtf', 'yolo'];
            const tagLower = hashtag.substring(1).toLowerCase();
            if (casualTags.includes(tagLower))
                return false;
        }
        return true;
    }
    getPlatformSpecificHashtags(platform) {
        const platformTags = {
            twitter: ['#trending', '#viral'],
            instagram: ['#instagood', '#photooftheday', '#love', '#instagram'],
            linkedin: ['#networking', '#career', '#professional', '#industry'],
            tiktok: ['#fyp', '#foryou', '#viral', '#trending'],
            youtube: ['#youtube', '#subscribe', '#video'],
            blog: [],
            email: [],
            threads: ['#threads'],
            facebook: ['#facebook'],
            pinterest: ['#pinterest', '#pinspiration'],
        };
        return platformTags[platform] || [];
    }
    updateTrending(platform, hashtag, data) {
        if (!this.trendingHashtags.has(platform)) {
            this.trendingHashtags.set(platform, new Map());
        }
        this.trendingHashtags.get(platform).set(hashtag, data);
    }
    getTrending(platform, limit = 10) {
        const platformTrending = this.trendingHashtags.get(platform);
        if (!platformTrending)
            return [];
        return Array.from(platformTrending.values())
            .sort((a, b) => b.volume - a.volume)
            .slice(0, limit);
    }
}
// ============================================================================
// Media Transformer
// ============================================================================
export class MediaTransformer {
    transformationQueue;
    constructor() {
        this.transformationQueue = new Map();
    }
    async transform(media, targetPlatform, options = {}) {
        const constraints = PLATFORM_CONSTRAINTS[targetPlatform];
        const transformations = [];
        // Validate media type support
        if (!constraints.supportedMediaTypes.includes(media.type)) {
            throw new MediaTransformError(`Media type "${media.type}" not supported on ${targetPlatform}`, 'UNSUPPORTED_TYPE');
        }
        // Create transformed media object
        const transformedMedia = {
            ...media,
            id: `${media.id}_${targetPlatform}_${Date.now()}`,
        };
        // Determine required transformations
        if (media.type === 'image' || media.type === 'video') {
            // Aspect ratio adjustment
            const aspectRatioTransform = this.calculateAspectRatioTransform(media, constraints.mediaAspectRatios, options.resizeStrategy || 'fit');
            if (aspectRatioTransform) {
                transformations.push(aspectRatioTransform);
                transformedMedia.width = aspectRatioTransform.params.targetWidth;
                transformedMedia.height = aspectRatioTransform.params.targetHeight;
            }
            // File size compression
            if (media.type === 'image' && constraints.maxImageSize && media.fileSize) {
                if (media.fileSize > constraints.maxImageSize) {
                    transformations.push({
                        type: 'compress',
                        params: {
                            targetSize: constraints.maxImageSize,
                            quality: options.compressionQuality || 85,
                        },
                        status: 'pending',
                    });
                }
            }
            if (media.type === 'video' && constraints.maxVideoSize && media.fileSize) {
                if (media.fileSize > constraints.maxVideoSize) {
                    transformations.push({
                        type: 'compress',
                        params: {
                            targetSize: constraints.maxVideoSize,
                            quality: options.compressionQuality || 80,
                        },
                        status: 'pending',
                    });
                }
            }
        }
        // Video duration trimming
        if (media.type === 'video' && constraints.maxVideoLength && media.duration) {
            if (media.duration > constraints.maxVideoLength) {
                transformations.push({
                    type: 'duration_trim',
                    params: {
                        maxDuration: constraints.maxVideoLength,
                        originalDuration: media.duration,
                    },
                    status: 'pending',
                });
                transformedMedia.duration = constraints.maxVideoLength;
            }
        }
        // Generate thumbnail if needed
        if (media.type === 'video' && !media.thumbnailUrl) {
            transformations.push({
                type: 'thumbnail_generate',
                params: {
                    timestamp: Math.min(3, media.duration || 0),
                },
                status: 'pending',
            });
        }
        // Mark transformations as completed (simulation - actual processing would be async)
        for (const transform of transformations) {
            transform.status = 'completed';
        }
        return {
            original: media,
            transformed: transformedMedia,
            transformations,
        };
    }
    async transformBatch(mediaList, targetPlatform, options = {}) {
        const constraints = PLATFORM_CONSTRAINTS[targetPlatform];
        // Limit to max media count
        const limitedList = mediaList.slice(0, constraints.maxMediaCount);
        const results = await Promise.all(limitedList.map(media => this.transform(media, targetPlatform, options)));
        return results;
    }
    calculateAspectRatioTransform(media, targetRatios, strategy) {
        if (!media.width || !media.height)
            return null;
        const currentRatio = media.width / media.height;
        // Find best matching or recommended ratio
        const recommendedRatio = targetRatios.find(r => r.recommended) || targetRatios[0];
        if (!recommendedRatio)
            return null;
        const targetRatioValue = recommendedRatio.width / recommendedRatio.height;
        const ratioDiff = Math.abs(currentRatio - targetRatioValue);
        // If already close enough, no transformation needed
        if (ratioDiff < 0.05)
            return null;
        let targetWidth;
        let targetHeight;
        if (strategy === 'fit') {
            // Fit within bounds, maintaining aspect ratio with letterboxing
            if (currentRatio > targetRatioValue) {
                targetWidth = media.width;
                targetHeight = Math.round(media.width / targetRatioValue);
            }
            else {
                targetHeight = media.height;
                targetWidth = Math.round(media.height * targetRatioValue);
            }
        }
        else if (strategy === 'fill' || strategy === 'crop') {
            // Fill/crop to exact ratio
            if (currentRatio > targetRatioValue) {
                targetHeight = media.height;
                targetWidth = Math.round(media.height * targetRatioValue);
            }
            else {
                targetWidth = media.width;
                targetHeight = Math.round(media.width / targetRatioValue);
            }
        }
        else {
            targetWidth = media.width;
            targetHeight = media.height;
        }
        return {
            type: strategy === 'crop' ? 'crop' : 'resize',
            params: {
                originalWidth: media.width,
                originalHeight: media.height,
                targetWidth,
                targetHeight,
                targetRatio: recommendedRatio.name,
                strategy,
            },
            status: 'pending',
        };
    }
    getTransformationStatus(jobId) {
        return this.transformationQueue.get(jobId);
    }
    getSupportedFormats(platform) {
        return PLATFORM_CONSTRAINTS[platform].supportedMediaTypes;
    }
    getMaxDimensions(platform) {
        const constraints = PLATFORM_CONSTRAINTS[platform];
        // Standard max dimensions per platform
        const maxDimensions = {
            twitter: { maxWidth: 4096, maxHeight: 4096 },
            instagram: { maxWidth: 1080, maxHeight: 1350 },
            linkedin: { maxWidth: 4000, maxHeight: 4000 },
            tiktok: { maxWidth: 1080, maxHeight: 1920 },
            youtube: { maxWidth: 3840, maxHeight: 2160 },
            blog: { maxWidth: 2000, maxHeight: 2000 },
            email: { maxWidth: 600, maxHeight: 1200 },
            threads: { maxWidth: 1080, maxHeight: 1350 },
            facebook: { maxWidth: 2048, maxHeight: 2048 },
            pinterest: { maxWidth: 1000, maxHeight: 1500 },
        };
        return {
            ...maxDimensions[platform],
            aspectRatios: constraints.mediaAspectRatios,
        };
    }
}
export class MediaTransformError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'MediaTransformError';
    }
}
// ============================================================================
// Content Scheduler
// ============================================================================
export class ContentScheduler {
    optimalTimes;
    scheduledContent;
    timezone;
    constructor(timezone = 'UTC') {
        this.timezone = timezone;
        this.optimalTimes = new Map();
        this.scheduledContent = new Map();
        this.initializeOptimalTimes();
    }
    initializeOptimalTimes() {
        // Based on industry research for optimal posting times
        this.optimalTimes.set('twitter', [
            { platform: 'twitter', dayOfWeek: 1, hour: 9, minute: 0, timezone: 'UTC', engagementScore: 0.85 },
            { platform: 'twitter', dayOfWeek: 2, hour: 10, minute: 0, timezone: 'UTC', engagementScore: 0.90 },
            { platform: 'twitter', dayOfWeek: 3, hour: 12, minute: 0, timezone: 'UTC', engagementScore: 0.88 },
            { platform: 'twitter', dayOfWeek: 4, hour: 9, minute: 0, timezone: 'UTC', engagementScore: 0.87 },
            { platform: 'twitter', dayOfWeek: 5, hour: 11, minute: 0, timezone: 'UTC', engagementScore: 0.82 },
        ]);
        this.optimalTimes.set('instagram', [
            { platform: 'instagram', dayOfWeek: 1, hour: 11, minute: 0, timezone: 'UTC', engagementScore: 0.88 },
            { platform: 'instagram', dayOfWeek: 2, hour: 10, minute: 0, timezone: 'UTC', engagementScore: 0.85 },
            { platform: 'instagram', dayOfWeek: 3, hour: 11, minute: 0, timezone: 'UTC', engagementScore: 0.92 },
            { platform: 'instagram', dayOfWeek: 4, hour: 14, minute: 0, timezone: 'UTC', engagementScore: 0.86 },
            { platform: 'instagram', dayOfWeek: 5, hour: 10, minute: 0, timezone: 'UTC', engagementScore: 0.80 },
            { platform: 'instagram', dayOfWeek: 6, hour: 9, minute: 0, timezone: 'UTC', engagementScore: 0.75 },
        ]);
        this.optimalTimes.set('linkedin', [
            { platform: 'linkedin', dayOfWeek: 1, hour: 7, minute: 30, timezone: 'UTC', engagementScore: 0.88 },
            { platform: 'linkedin', dayOfWeek: 2, hour: 10, minute: 0, timezone: 'UTC', engagementScore: 0.95 },
            { platform: 'linkedin', dayOfWeek: 3, hour: 12, minute: 0, timezone: 'UTC', engagementScore: 0.92 },
            { platform: 'linkedin', dayOfWeek: 4, hour: 8, minute: 0, timezone: 'UTC', engagementScore: 0.90 },
            { platform: 'linkedin', dayOfWeek: 5, hour: 9, minute: 0, timezone: 'UTC', engagementScore: 0.78 },
        ]);
        this.optimalTimes.set('tiktok', [
            { platform: 'tiktok', dayOfWeek: 0, hour: 19, minute: 0, timezone: 'UTC', engagementScore: 0.88 },
            { platform: 'tiktok', dayOfWeek: 1, hour: 12, minute: 0, timezone: 'UTC', engagementScore: 0.85 },
            { platform: 'tiktok', dayOfWeek: 2, hour: 15, minute: 0, timezone: 'UTC', engagementScore: 0.92 },
            { platform: 'tiktok', dayOfWeek: 4, hour: 19, minute: 0, timezone: 'UTC', engagementScore: 0.90 },
            { platform: 'tiktok', dayOfWeek: 5, hour: 21, minute: 0, timezone: 'UTC', engagementScore: 0.95 },
            { platform: 'tiktok', dayOfWeek: 6, hour: 20, minute: 0, timezone: 'UTC', engagementScore: 0.93 },
        ]);
        this.optimalTimes.set('youtube', [
            { platform: 'youtube', dayOfWeek: 4, hour: 15, minute: 0, timezone: 'UTC', engagementScore: 0.88 },
            { platform: 'youtube', dayOfWeek: 5, hour: 17, minute: 0, timezone: 'UTC', engagementScore: 0.92 },
            { platform: 'youtube', dayOfWeek: 6, hour: 12, minute: 0, timezone: 'UTC', engagementScore: 0.95 },
            { platform: 'youtube', dayOfWeek: 0, hour: 11, minute: 0, timezone: 'UTC', engagementScore: 0.90 },
        ]);
        this.optimalTimes.set('facebook', [
            { platform: 'facebook', dayOfWeek: 1, hour: 9, minute: 0, timezone: 'UTC', engagementScore: 0.85 },
            { platform: 'facebook', dayOfWeek: 2, hour: 13, minute: 0, timezone: 'UTC', engagementScore: 0.88 },
            { platform: 'facebook', dayOfWeek: 3, hour: 11, minute: 0, timezone: 'UTC', engagementScore: 0.90 },
            { platform: 'facebook', dayOfWeek: 4, hour: 12, minute: 0, timezone: 'UTC', engagementScore: 0.87 },
            { platform: 'facebook', dayOfWeek: 5, hour: 9, minute: 0, timezone: 'UTC', engagementScore: 0.82 },
        ]);
        // Default times for other platforms
        const defaultSlots = [
            { platform: 'blog', dayOfWeek: 2, hour: 10, minute: 0, timezone: 'UTC', engagementScore: 0.85 },
            { platform: 'blog', dayOfWeek: 4, hour: 10, minute: 0, timezone: 'UTC', engagementScore: 0.85 },
        ];
        this.optimalTimes.set('blog', defaultSlots);
        this.optimalTimes.set('email', [
            { platform: 'email', dayOfWeek: 2, hour: 10, minute: 0, timezone: 'UTC', engagementScore: 0.90 },
            { platform: 'email', dayOfWeek: 4, hour: 14, minute: 0, timezone: 'UTC', engagementScore: 0.88 },
        ]);
    }
    getOptimalTime(platform, fromDate = new Date(), options = {}) {
        const platformSlots = this.optimalTimes.get(platform) || [];
        if (platformSlots.length === 0) {
            // Default to next day at 10 AM
            const nextDay = new Date(fromDate);
            nextDay.setDate(nextDay.getDate() + 1);
            nextDay.setHours(10, 0, 0, 0);
            return nextDay;
        }
        // Sort by engagement score
        const sortedSlots = [...platformSlots].sort((a, b) => (b.engagementScore || 0) - (a.engagementScore || 0));
        // Find next available slot
        const currentDay = fromDate.getDay();
        const currentHour = fromDate.getHours();
        const currentMinute = fromDate.getMinutes();
        for (const slot of sortedSlots) {
            const targetDate = new Date(fromDate);
            // Calculate days until target day
            let daysUntil = slot.dayOfWeek - currentDay;
            if (daysUntil < 0)
                daysUntil += 7;
            if (daysUntil === 0 && (slot.hour < currentHour ||
                (slot.hour === currentHour && slot.minute <= currentMinute))) {
                daysUntil = 7; // Next week
            }
            targetDate.setDate(targetDate.getDate() + daysUntil);
            targetDate.setHours(slot.hour, slot.minute, 0, 0);
            // Check if within date range constraints
            if (options.notBefore && targetDate < options.notBefore)
                continue;
            if (options.notAfter && targetDate > options.notAfter)
                continue;
            // Check for conflicts
            if (!this.hasConflict(platform, targetDate, options.minGapMinutes || 30)) {
                return targetDate;
            }
        }
        // Fallback: next available hour
        const fallback = new Date(fromDate);
        fallback.setHours(fallback.getHours() + 1, 0, 0, 0);
        return fallback;
    }
    getOptimalTimesForBatch(platforms, fromDate = new Date(), options = {}) {
        const result = new Map();
        let currentDate = new Date(fromDate);
        // Space out posts across platforms
        const minGap = options.minGapMinutes || 60; // Default 1 hour between posts
        for (const platform of platforms) {
            const optimalTime = this.getOptimalTime(platform, currentDate, {
                ...options,
                notBefore: currentDate,
            });
            result.set(platform, optimalTime);
            // Move forward for next platform
            currentDate = new Date(optimalTime.getTime() + minGap * 60 * 1000);
        }
        return result;
    }
    schedule(contentId, platform, content, scheduledTime) {
        const item = {
            id: `sched_${crypto.randomBytes(8).toString('hex')}`,
            contentId,
            platform,
            content,
            scheduledTime,
            status: 'scheduled',
            createdAt: new Date(),
        };
        this.scheduledContent.set(item.id, item);
        return item;
    }
    cancel(scheduleId) {
        const item = this.scheduledContent.get(scheduleId);
        if (!item || item.status !== 'scheduled')
            return false;
        item.status = 'cancelled';
        return true;
    }
    reschedule(scheduleId, newTime) {
        const item = this.scheduledContent.get(scheduleId);
        if (!item || item.status !== 'scheduled')
            return null;
        item.scheduledTime = newTime;
        return item;
    }
    getScheduledContent(filter) {
        let items = Array.from(this.scheduledContent.values());
        if (filter?.platform) {
            items = items.filter(item => item.platform === filter.platform);
        }
        if (filter?.status) {
            items = items.filter(item => item.status === filter.status);
        }
        return items.sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());
    }
    getUpcoming(limit = 10) {
        const now = new Date();
        return this.getScheduledContent({ status: 'scheduled' })
            .filter(item => item.scheduledTime > now)
            .slice(0, limit);
    }
    hasConflict(platform, time, minGapMinutes) {
        const minGapMs = minGapMinutes * 60 * 1000;
        for (const item of this.scheduledContent.values()) {
            if (item.platform === platform && item.status === 'scheduled') {
                const diff = Math.abs(item.scheduledTime.getTime() - time.getTime());
                if (diff < minGapMs)
                    return true;
            }
        }
        return false;
    }
    updateOptimalTimes(platform, slots) {
        this.optimalTimes.set(platform, slots);
    }
    setTimezone(timezone) {
        this.timezone = timezone;
    }
}
class BasePlatformAdapter {
    toneAdjuster;
    hashtagGenerator;
    mediaTransformer;
    constructor(toneAdjuster, hashtagGenerator, mediaTransformer) {
        this.toneAdjuster = toneAdjuster;
        this.hashtagGenerator = hashtagGenerator;
        this.mediaTransformer = mediaTransformer;
    }
    truncateText(text, maxLength, preserveWords = true) {
        if (text.length <= maxLength)
            return text;
        if (!preserveWords) {
            return text.substring(0, maxLength - 3) + '...';
        }
        const truncated = text.substring(0, maxLength - 3);
        const lastSpace = truncated.lastIndexOf(' ');
        if (lastSpace > maxLength * 0.7) {
            return truncated.substring(0, lastSpace) + '...';
        }
        return truncated + '...';
    }
    extractMentions(text) {
        const mentions = text.match(/@[\w]+/g) || [];
        return [...new Set(mentions)];
    }
    extractLinks(text) {
        const urlRegex = /https?:\/\/[^\s]+/g;
        return text.match(urlRegex) || [];
    }
    removeExcessiveWhitespace(text) {
        return text.replace(/\s+/g, ' ').trim();
    }
    createBaseResult(content, options) {
        return {
            platform: this.platform,
            mentions: content.mentions || this.extractMentions(content.text),
            tone: options.targetTone || 'conversational',
            warnings: [],
            metadata: {
                originalContentId: content.id,
                repurposedAt: new Date(),
                adapterId: `${this.platform}_adapter`,
                transformations: [],
            },
        };
    }
}
class TwitterAdapter extends BasePlatformAdapter {
    platform = 'twitter';
    constraints = PLATFORM_CONSTRAINTS.twitter;
    async adapt(content, options) {
        const result = this.createBaseResult(content, options);
        const warnings = [];
        // Adjust tone
        const toneResult = this.toneAdjuster.adjustTone(content.text, options.targetTone || 'conversational', this.platform);
        result.metadata.transformations.push('tone_adjustment');
        let text = toneResult.adjustedText;
        // Generate/process hashtags
        const hashtagResult = await this.hashtagGenerator.generate(text, this.platform, {
            maxCount: options.maxHashtags ?? 3,
            preserveExisting: options.preserveHashtags,
        });
        result.hashtags = hashtagResult.hashtags;
        // Remove existing hashtags from text to recalculate length
        text = text.replace(/#\w+\s*/g, '').trim();
        // Calculate space needed for hashtags
        const hashtagText = result.hashtags.join(' ');
        const hashtagSpace = hashtagText.length > 0 ? hashtagText.length + 1 : 0;
        const availableLength = this.constraints.maxTextLength - hashtagSpace;
        // Check if we need to create a thread
        if (text.length > availableLength) {
            if (this.constraints.supportsThreads) {
                result.thread = await this.createThread(text, result.hashtags, options);
                text = result.thread[0].text;
                warnings.push('Content split into thread');
            }
            else {
                text = this.truncateText(text, availableLength);
                warnings.push('Content truncated to fit character limit');
            }
        }
        // Combine text with hashtags
        if (result.hashtags.length > 0) {
            text = `${text}\n\n${result.hashtags.join(' ')}`;
        }
        result.text = text;
        result.characterCount = text.length;
        result.isWithinLimits = text.length <= this.constraints.maxTextLength;
        result.warnings = warnings;
        // Transform media
        if (content.media && content.media.length > 0) {
            result.media = await this.mediaTransformer.transformBatch(content.media, this.platform, options.mediaTransformations);
        }
        else {
            result.media = [];
        }
        return result;
    }
    async createThread(text, hashtags, options) {
        const threads = [];
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        const maxLength = this.constraints.maxTextLength - 10; // Space for thread numbering
        let currentChunk = '';
        let chunkIndex = 1;
        for (const sentence of sentences) {
            if ((currentChunk + sentence).length > maxLength) {
                if (currentChunk) {
                    threads.push(this.createThreadPart(currentChunk.trim(), chunkIndex, hashtags, options));
                    chunkIndex++;
                }
                currentChunk = sentence;
            }
            else {
                currentChunk += sentence;
            }
        }
        if (currentChunk) {
            threads.push(this.createThreadPart(currentChunk.trim(), chunkIndex, hashtags, options));
        }
        // Add hashtags only to last thread
        if (threads.length > 0 && hashtags.length > 0) {
            const lastThread = threads[threads.length - 1];
            lastThread.text += `\n\n${hashtags.join(' ')}`;
            lastThread.characterCount = lastThread.text.length;
        }
        return threads;
    }
    createThreadPart(text, index, hashtags, options) {
        const numberedText = `${index}/ ${text}`;
        return {
            platform: this.platform,
            text: numberedText,
            hashtags: index === 1 ? [] : hashtags, // Hashtags only on last tweet
            mentions: [],
            media: [],
            tone: options.targetTone || 'conversational',
            characterCount: numberedText.length,
            isWithinLimits: numberedText.length <= this.constraints.maxTextLength,
            warnings: [],
            metadata: {
                repurposedAt: new Date(),
                adapterId: 'twitter_adapter',
                transformations: ['thread_split'],
            },
        };
    }
}
class InstagramAdapter extends BasePlatformAdapter {
    platform = 'instagram';
    constraints = PLATFORM_CONSTRAINTS.instagram;
    async adapt(content, options) {
        const result = this.createBaseResult(content, options);
        const warnings = [];
        // Adjust tone - Instagram is typically casual/inspirational
        const defaultTone = options.targetTone || 'casual';
        const toneResult = this.toneAdjuster.adjustTone(content.text, defaultTone, this.platform);
        result.metadata.transformations.push('tone_adjustment');
        let text = toneResult.adjustedText;
        // Generate hashtags - Instagram supports many
        const hashtagResult = await this.hashtagGenerator.generate(text, this.platform, {
            maxCount: options.maxHashtags ?? 20,
            preserveExisting: options.preserveHashtags,
        });
        result.hashtags = hashtagResult.hashtags;
        // Add emojis if requested
        if (options.includeEmojis !== false) {
            text = this.addEmojis(text);
            result.metadata.transformations.push('emoji_enhancement');
        }
        // Format for Instagram - hashtags at end, often with line breaks
        const hashtagBlock = result.hashtags.length > 0
            ? '\n.\n.\n.\n' + result.hashtags.join(' ')
            : '';
        const availableLength = this.constraints.maxTextLength - hashtagBlock.length;
        if (text.length > availableLength) {
            text = this.truncateText(text, availableLength);
            warnings.push('Caption truncated to fit limit');
        }
        result.text = text + hashtagBlock;
        result.characterCount = result.text.length;
        result.isWithinLimits = result.text.length <= this.constraints.maxTextLength;
        result.warnings = warnings;
        // Transform media - Instagram is media-focused
        if (content.media && content.media.length > 0) {
            result.media = await this.mediaTransformer.transformBatch(content.media, this.platform, {
                ...options.mediaTransformations,
                resizeStrategy: 'fill', // Instagram prefers filled images
            });
            // Add alt text warning if missing
            for (const media of result.media) {
                if (!media.transformed.altText && this.constraints.requiresAltText) {
                    warnings.push(`Alt text recommended for accessibility: ${media.transformed.id}`);
                }
            }
        }
        else {
            result.media = [];
            warnings.push('Instagram posts perform better with media');
        }
        return result;
    }
    addEmojis(text) {
        // Add contextual emojis based on content
        const emojiMap = {
            'love': '❤️',
            'happy': '😊',
            'excited': '🎉',
            'new': '✨',
            'tip': '💡',
            'food': '🍽️',
            'travel': '✈️',
            'fitness': '💪',
            'beauty': '💄',
            'fashion': '👗',
            'music': '🎵',
            'photo': '📸',
            'video': '🎬',
        };
        let result = text;
        for (const [word, emoji] of Object.entries(emojiMap)) {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            if (regex.test(result) && !result.includes(emoji)) {
                // Add emoji after first occurrence
                result = result.replace(regex, `$& ${emoji}`);
                break; // Only add one emoji to avoid over-saturation
            }
        }
        return result;
    }
}
class LinkedInAdapter extends BasePlatformAdapter {
    platform = 'linkedin';
    constraints = PLATFORM_CONSTRAINTS.linkedin;
    async adapt(content, options) {
        const result = this.createBaseResult(content, options);
        const warnings = [];
        // LinkedIn requires professional tone
        const targetTone = options.targetTone || 'professional';
        const toneResult = this.toneAdjuster.adjustTone(content.text, targetTone, this.platform);
        result.metadata.transformations.push('tone_adjustment');
        let text = toneResult.adjustedText;
        // Structure for LinkedIn - hook, body, CTA
        text = this.structureForLinkedIn(text);
        result.metadata.transformations.push('linkedin_formatting');
        // Generate professional hashtags
        const hashtagResult = await this.hashtagGenerator.generate(text, this.platform, {
            maxCount: options.maxHashtags ?? 5,
            preserveExisting: options.preserveHashtags,
        });
        result.hashtags = hashtagResult.hashtags;
        // Add hashtags at the end
        const hashtagText = result.hashtags.length > 0 ? '\n\n' + result.hashtags.join(' ') : '';
        const availableLength = this.constraints.maxTextLength - hashtagText.length;
        if (text.length > availableLength) {
            text = this.truncateText(text, availableLength);
            warnings.push('Content truncated for LinkedIn');
        }
        result.text = text + hashtagText;
        result.characterCount = result.text.length;
        result.isWithinLimits = result.text.length <= this.constraints.maxTextLength;
        result.warnings = warnings;
        // Transform media
        if (content.media && content.media.length > 0) {
            result.media = await this.mediaTransformer.transformBatch(content.media, this.platform, options.mediaTransformations);
        }
        else {
            result.media = [];
        }
        return result;
    }
    structureForLinkedIn(text) {
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        if (sentences.length < 3)
            return text;
        // Create hook (first sentence, potentially shortened)
        let hook = sentences[0].trim();
        if (hook.length > 150) {
            hook = hook.substring(0, 147) + '...';
        }
        // Body (remaining sentences)
        const body = sentences.slice(1).join(' ').trim();
        // Add line breaks for readability
        const formattedText = `${hook}\n\n${body}`;
        // Add a subtle CTA if not present
        const ctaKeywords = ['comment', 'share', 'thoughts', 'agree', 'experience', 'what do you think'];
        const hasCallToAction = ctaKeywords.some(keyword => formattedText.toLowerCase().includes(keyword));
        if (!hasCallToAction && formattedText.length < this.constraints.maxTextLength - 50) {
            return formattedText + '\n\nWhat are your thoughts?';
        }
        return formattedText;
    }
}
class TikTokAdapter extends BasePlatformAdapter {
    platform = 'tiktok';
    constraints = PLATFORM_CONSTRAINTS.tiktok;
    async adapt(content, options) {
        const result = this.createBaseResult(content, options);
        const warnings = [];
        // TikTok is casual and trendy
        const targetTone = options.targetTone || 'casual';
        const toneResult = this.toneAdjuster.adjustTone(content.text, targetTone, this.platform);
        // Convert to script format
        let text = this.convertToScript(toneResult.adjustedText);
        result.metadata.transformations.push('script_conversion');
        // Generate trendy hashtags
        const hashtagResult = await this.hashtagGenerator.generate(text, this.platform, {
            maxCount: options.maxHashtags ?? 8,
            preserveExisting: options.preserveHashtags,
        });
        result.hashtags = hashtagResult.hashtags;
        // Ensure #fyp and #foryou for discoverability
        if (!result.hashtags.some(h => h.toLowerCase() === '#fyp')) {
            result.hashtags.unshift('#fyp');
        }
        const hashtagText = result.hashtags.join(' ');
        const availableLength = this.constraints.maxTextLength - hashtagText.length - 2;
        if (text.length > availableLength) {
            text = this.truncateText(text, availableLength);
            warnings.push('Description shortened for TikTok');
        }
        result.text = `${text}\n\n${hashtagText}`;
        result.characterCount = result.text.length;
        result.isWithinLimits = result.text.length <= this.constraints.maxTextLength;
        result.warnings = warnings;
        // TikTok requires video
        if (content.media && content.media.length > 0) {
            const videoMedia = content.media.filter(m => m.type === 'video');
            if (videoMedia.length > 0) {
                result.media = await this.mediaTransformer.transformBatch([videoMedia[0]], // TikTok only supports one video
                this.platform, {
                    ...options.mediaTransformations,
                    resizeStrategy: 'fill',
                });
            }
            else {
                result.media = [];
                warnings.push('TikTok requires video content');
            }
        }
        else {
            result.media = [];
            warnings.push('TikTok requires video content');
        }
        return result;
    }
    convertToScript(text) {
        // Convert long-form content to a casual video script format
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        // Create hook
        const hook = sentences[0]?.trim() || text;
        // Keep it short and punchy
        const bodyPoints = sentences.slice(1, 4).map(s => `• ${s.trim()}`);
        if (bodyPoints.length > 0) {
            return `${hook}\n\n${bodyPoints.join('\n')}`;
        }
        return hook;
    }
}
class YouTubeAdapter extends BasePlatformAdapter {
    platform = 'youtube';
    constraints = PLATFORM_CONSTRAINTS.youtube;
    async adapt(content, options) {
        const result = this.createBaseResult(content, options);
        const warnings = [];
        // YouTube descriptions can be longer and more detailed
        const targetTone = options.targetTone || 'educational';
        const toneResult = this.toneAdjuster.adjustTone(content.text, targetTone, this.platform);
        // Format as YouTube description
        let text = this.formatDescription(toneResult.adjustedText, content);
        result.metadata.transformations.push('youtube_description_format');
        // Generate hashtags
        const hashtagResult = await this.hashtagGenerator.generate(text, this.platform, {
            maxCount: options.maxHashtags ?? 10,
            preserveExisting: options.preserveHashtags,
        });
        result.hashtags = hashtagResult.hashtags;
        // Add title if provided
        if (content.title) {
            result.title = content.title;
        }
        // YouTube hashtags go at top of description (first 3) or end
        const topHashtags = result.hashtags.slice(0, 3).join(' ');
        const bottomHashtags = result.hashtags.slice(3).join(' ');
        if (topHashtags) {
            text = `${topHashtags}\n\n${text}`;
        }
        if (bottomHashtags) {
            text = `${text}\n\n${bottomHashtags}`;
        }
        if (text.length > this.constraints.maxTextLength) {
            text = this.truncateText(text, this.constraints.maxTextLength);
            warnings.push('Description truncated');
        }
        result.text = text;
        result.characterCount = result.text.length;
        result.isWithinLimits = result.text.length <= this.constraints.maxTextLength;
        result.warnings = warnings;
        // Transform video media
        if (content.media && content.media.length > 0) {
            const videoMedia = content.media.filter(m => m.type === 'video');
            if (videoMedia.length > 0) {
                result.media = await this.mediaTransformer.transformBatch(videoMedia, this.platform, options.mediaTransformations);
            }
            else {
                result.media = [];
                warnings.push('YouTube is a video platform - consider adding video content');
            }
        }
        else {
            result.media = [];
        }
        return result;
    }
    formatDescription(text, content) {
        const sections = [];
        // Main content
        sections.push(text);
        // Add links section if links exist
        const links = content.links || this.extractLinks(text);
        if (links.length > 0) {
            sections.push('\n📌 LINKS MENTIONED');
            links.forEach(link => sections.push(link));
        }
        // Add standard YouTube elements
        sections.push('\n📺 SUBSCRIBE for more content!');
        sections.push('👍 Like this video if you found it helpful');
        sections.push('💬 Comment your thoughts below');
        return sections.join('\n');
    }
}
class BlogAdapter extends BasePlatformAdapter {
    platform = 'blog';
    constraints = PLATFORM_CONSTRAINTS.blog;
    async adapt(content, options) {
        const result = this.createBaseResult(content, options);
        const warnings = [];
        // Blog posts are typically educational or professional
        const targetTone = options.targetTone || 'educational';
        const toneResult = this.toneAdjuster.adjustTone(content.text, targetTone, this.platform);
        // Expand and format for blog
        let text = this.formatBlogPost(toneResult.adjustedText, content);
        result.metadata.transformations.push('blog_formatting');
        // Generate SEO-friendly tags
        const hashtagResult = await this.hashtagGenerator.generate(text, this.platform, {
            maxCount: options.maxHashtags ?? 10,
            preserveExisting: options.preserveHashtags,
        });
        // Convert hashtags to tags (without #)
        result.hashtags = hashtagResult.hashtags.map(h => h.replace('#', ''));
        if (content.title) {
            result.title = content.title;
        }
        else {
            // Generate title from content
            result.title = this.generateTitle(text);
            result.metadata.transformations.push('title_generation');
        }
        result.text = text;
        result.characterCount = result.text.length;
        result.isWithinLimits = result.text.length <= this.constraints.maxTextLength;
        result.warnings = warnings;
        // Transform media
        if (content.media && content.media.length > 0) {
            result.media = await this.mediaTransformer.transformBatch(content.media, this.platform, options.mediaTransformations);
        }
        else {
            result.media = [];
        }
        return result;
    }
    formatBlogPost(text, content) {
        const paragraphs = text.split(/\n\n+/);
        // Ensure proper paragraph structure
        const formattedParagraphs = paragraphs.map(p => {
            const trimmed = p.trim();
            // Add proper punctuation if missing
            if (trimmed && !/[.!?]$/.test(trimmed)) {
                return trimmed + '.';
            }
            return trimmed;
        }).filter(p => p);
        // Create introduction (first paragraph)
        let result = formattedParagraphs[0] || text;
        // Add body paragraphs with spacing
        if (formattedParagraphs.length > 1) {
            result += '\n\n' + formattedParagraphs.slice(1).join('\n\n');
        }
        // Add conclusion marker if content is long enough
        if (result.length > 500) {
            result += '\n\n---\n\n*Conclusion*\n\n';
            result += 'Thank you for reading. Share your thoughts in the comments below.';
        }
        return result;
    }
    generateTitle(text) {
        // Extract first sentence or create from keywords
        const firstSentence = text.match(/^[^.!?]+[.!?]/)?.[0] || text.substring(0, 100);
        // Clean and truncate
        let title = firstSentence
            .replace(/[.!?]$/, '')
            .trim();
        if (title.length > 60) {
            title = title.substring(0, 57) + '...';
        }
        return title;
    }
}
class EmailAdapter extends BasePlatformAdapter {
    platform = 'email';
    constraints = PLATFORM_CONSTRAINTS.email;
    async adapt(content, options) {
        const result = this.createBaseResult(content, options);
        const warnings = [];
        // Email tone depends on context
        const targetTone = options.targetTone || 'conversational';
        const toneResult = this.toneAdjuster.adjustTone(content.text, targetTone, this.platform);
        // Format as email newsletter
        let text = this.formatNewsletterEmail(toneResult.adjustedText, content);
        result.metadata.transformations.push('email_formatting');
        // Email doesn't use hashtags
        result.hashtags = [];
        // Set subject line
        if (content.title) {
            result.title = content.title;
        }
        else {
            result.title = this.generateSubjectLine(text);
            result.metadata.transformations.push('subject_generation');
        }
        result.text = text;
        result.characterCount = result.text.length;
        result.isWithinLimits = result.text.length <= this.constraints.maxTextLength;
        result.warnings = warnings;
        // Transform media (email has image limitations)
        if (content.media && content.media.length > 0) {
            const imageMedia = content.media.filter(m => m.type === 'image' || m.type === 'gif');
            result.media = await this.mediaTransformer.transformBatch(imageMedia.slice(0, this.constraints.maxMediaCount), this.platform, {
                ...options.mediaTransformations,
                compressionQuality: 70, // Optimize for email
            });
        }
        else {
            result.media = [];
        }
        return result;
    }
    formatNewsletterEmail(text, content) {
        const sections = [];
        // Greeting
        sections.push('Hi there,');
        sections.push('');
        // Main content with proper formatting
        const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
        sections.push(...paragraphs);
        // Call to action
        sections.push('');
        sections.push('---');
        sections.push('');
        // Links if provided
        const links = content.links || [];
        if (links.length > 0) {
            sections.push('📎 Quick Links:');
            links.forEach(link => sections.push(`• ${link}`));
            sections.push('');
        }
        // Sign off
        sections.push('Best regards,');
        sections.push('[Your Name]');
        sections.push('');
        // Footer
        sections.push('---');
        sections.push('You received this email because you subscribed to our newsletter.');
        sections.push('Unsubscribe | Update preferences');
        return sections.join('\n');
    }
    generateSubjectLine(text) {
        // Extract key info for compelling subject
        const firstLine = text.split('\n')[0] || text;
        let subject = firstLine.replace(/^Hi there,?\s*/i, '').trim();
        // Get first meaningful sentence
        const firstSentence = subject.match(/^[^.!?]+[.!?]/)?.[0] || subject;
        // Clean and optimize length (50 chars ideal for email)
        subject = firstSentence.replace(/[.!?]$/, '').trim();
        if (subject.length > 50) {
            subject = subject.substring(0, 47) + '...';
        }
        return subject;
    }
}
// ============================================================================
// Content Repurposer Main Class
// ============================================================================
export class ContentRepurposer extends EventEmitter {
    adapters;
    toneAdjuster;
    hashtagGenerator;
    mediaTransformer;
    scheduler;
    processingStats;
    constructor(options = {}) {
        super();
        this.toneAdjuster = new ToneAdjuster();
        this.hashtagGenerator = new HashtagGenerator();
        this.mediaTransformer = new MediaTransformer();
        this.scheduler = new ContentScheduler(options.timezone);
        this.adapters = new Map();
        this.processingStats = {
            totalProcessed: 0,
            successCount: 0,
            failureCount: 0,
            averageProcessingTimeMs: 0,
            platformStats: new Map(),
        };
        this.initializeAdapters();
        console.log('[ContentRepurposer] Initialized with adapters:', Array.from(this.adapters.keys()).join(', '));
    }
    initializeAdapters() {
        this.adapters.set('twitter', new TwitterAdapter(this.toneAdjuster, this.hashtagGenerator, this.mediaTransformer));
        this.adapters.set('instagram', new InstagramAdapter(this.toneAdjuster, this.hashtagGenerator, this.mediaTransformer));
        this.adapters.set('linkedin', new LinkedInAdapter(this.toneAdjuster, this.hashtagGenerator, this.mediaTransformer));
        this.adapters.set('tiktok', new TikTokAdapter(this.toneAdjuster, this.hashtagGenerator, this.mediaTransformer));
        this.adapters.set('youtube', new YouTubeAdapter(this.toneAdjuster, this.hashtagGenerator, this.mediaTransformer));
        this.adapters.set('blog', new BlogAdapter(this.toneAdjuster, this.hashtagGenerator, this.mediaTransformer));
        this.adapters.set('email', new EmailAdapter(this.toneAdjuster, this.hashtagGenerator, this.mediaTransformer));
    }
    async repurpose(content, sourcePlatform, targetPlatforms, options = {}) {
        const startTime = Date.now();
        const repurposedContent = new Map();
        const errors = new Map();
        // Validate input
        if (!content.text || content.text.trim().length === 0) {
            return {
                success: false,
                sourceContent: content,
                sourcePlatform,
                targetPlatforms,
                repurposedContent,
                errors: new Map([['all', 'Content text is required']]),
                processingTimeMs: Date.now() - startTime,
            };
        }
        // Generate content ID if not provided
        if (!content.id) {
            content.id = `content_${crypto.randomBytes(8).toString('hex')}`;
        }
        this.emit('repurpose:start', {
            contentId: content.id,
            sourcePlatform,
            targetPlatforms,
        });
        // Process each target platform
        const platformPromises = targetPlatforms.map(async (platform) => {
            try {
                const adapter = this.adapters.get(platform);
                if (!adapter) {
                    throw new Error(`No adapter available for platform: ${platform}`);
                }
                const result = await adapter.adapt(content, options);
                // Schedule if requested
                if (options.scheduleOptimal) {
                    const optimalTime = this.scheduler.getOptimalTime(platform, new Date(), {
                        minGapMinutes: 60,
                    });
                    result.scheduledTime = optimalTime;
                }
                repurposedContent.set(platform, result);
                this.updatePlatformStats(platform, true);
                this.emit('repurpose:platform:success', {
                    contentId: content.id,
                    platform,
                    result,
                });
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                errors.set(platform, errorMessage);
                this.updatePlatformStats(platform, false);
                this.emit('repurpose:platform:error', {
                    contentId: content.id,
                    platform,
                    error: errorMessage,
                });
            }
        });
        await Promise.all(platformPromises);
        const processingTimeMs = Date.now() - startTime;
        const success = errors.size === 0;
        // Update stats
        this.processingStats.totalProcessed++;
        if (success) {
            this.processingStats.successCount++;
        }
        else {
            this.processingStats.failureCount++;
        }
        this.processingStats.averageProcessingTimeMs =
            (this.processingStats.averageProcessingTimeMs * (this.processingStats.totalProcessed - 1) +
                processingTimeMs) / this.processingStats.totalProcessed;
        const result = {
            success,
            sourceContent: content,
            sourcePlatform,
            targetPlatforms,
            repurposedContent,
            errors,
            processingTimeMs,
        };
        this.emit('repurpose:complete', result);
        return result;
    }
    async repurposeToAll(content, sourcePlatform, options = {}) {
        const allPlatforms = Array.from(this.adapters.keys()).filter(p => p !== sourcePlatform);
        return this.repurpose(content, sourcePlatform, allPlatforms, options);
    }
    getAdapter(platform) {
        return this.adapters.get(platform);
    }
    getPlatformConstraints(platform) {
        return PLATFORM_CONSTRAINTS[platform];
    }
    getSupportedPlatforms() {
        return Array.from(this.adapters.keys());
    }
    getToneAdjuster() {
        return this.toneAdjuster;
    }
    getHashtagGenerator() {
        return this.hashtagGenerator;
    }
    getMediaTransformer() {
        return this.mediaTransformer;
    }
    getScheduler() {
        return this.scheduler;
    }
    getStats() {
        return { ...this.processingStats };
    }
    updatePlatformStats(platform, success) {
        if (!this.processingStats.platformStats.has(platform)) {
            this.processingStats.platformStats.set(platform, {
                processed: 0,
                succeeded: 0,
                failed: 0,
            });
        }
        const stats = this.processingStats.platformStats.get(platform);
        stats.processed++;
        if (success) {
            stats.succeeded++;
        }
        else {
            stats.failed++;
        }
    }
    registerAdapter(platform, adapter) {
        this.adapters.set(platform, adapter);
        console.log(`[ContentRepurposer] Registered custom adapter for: ${platform}`);
    }
    async scheduleContent(content, sourcePlatform, targetPlatforms, options = {}) {
        const result = await this.repurpose(content, sourcePlatform, targetPlatforms, {
            ...options,
            scheduleOptimal: true,
        });
        const scheduledItems = new Map();
        for (const [platform, repurposed] of result.repurposedContent) {
            if (repurposed.scheduledTime) {
                const scheduled = this.scheduler.schedule(content.id, platform, repurposed, repurposed.scheduledTime);
                scheduledItems.set(platform, scheduled);
            }
        }
        return scheduledItems;
    }
    previewRepurpose(content, targetPlatform, options = {}) {
        const adapter = this.adapters.get(targetPlatform);
        if (!adapter) {
            throw new Error(`No adapter available for platform: ${targetPlatform}`);
        }
        return adapter.adapt(content, options);
    }
    validateContent(content, platform) {
        const constraints = PLATFORM_CONSTRAINTS[platform];
        if (!constraints) {
            return {
                valid: false,
                errors: [`Unknown platform: ${platform}`],
                warnings: [],
            };
        }
        const errors = [];
        const warnings = [];
        // Text length
        if (content.text.length > constraints.maxTextLength) {
            errors.push(`Text exceeds maximum length (${content.text.length}/${constraints.maxTextLength})`);
        }
        // Hashtag count
        const hashtags = content.hashtags || content.text.match(/#\w+/g) || [];
        if (hashtags.length > constraints.maxHashtags) {
            warnings.push(`Too many hashtags (${hashtags.length}/${constraints.maxHashtags})`);
        }
        // Media validation
        if (content.media) {
            if (content.media.length > constraints.maxMediaCount) {
                warnings.push(`Too many media items (${content.media.length}/${constraints.maxMediaCount})`);
            }
            for (const media of content.media) {
                if (!constraints.supportedMediaTypes.includes(media.type)) {
                    errors.push(`Media type "${media.type}" not supported on ${platform}`);
                }
                if (media.type === 'video' && media.duration && constraints.maxVideoLength) {
                    if (media.duration > constraints.maxVideoLength) {
                        warnings.push(`Video exceeds maximum duration (${media.duration}s/${constraints.maxVideoLength}s)`);
                    }
                }
                if (media.type === 'image' && media.fileSize && constraints.maxImageSize) {
                    if (media.fileSize > constraints.maxImageSize) {
                        warnings.push(`Image exceeds maximum size (${Math.round(media.fileSize / 1024 / 1024)}MB/${Math.round(constraints.maxImageSize / 1024 / 1024)}MB)`);
                    }
                }
            }
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }
}
// ============================================================================
// Export Default Instance Factory
// ============================================================================
let contentRepurposerInstance = null;
export function getContentRepurposer(options) {
    if (!contentRepurposerInstance) {
        contentRepurposerInstance = new ContentRepurposer(options);
    }
    return contentRepurposerInstance;
}
export function createContentRepurposer(options) {
    return new ContentRepurposer(options);
}
// ============================================================================
// Bridge Integration Helper
// ============================================================================
export class ContentRepurposerBridge {
    repurposer;
    constructor(repurposer) {
        this.repurposer = repurposer || getContentRepurposer();
    }
    async handleIncomingMessage(platform, content, metadata) {
        const contentInput = {
            text: content,
            metadata,
        };
        const targetPlatforms = this.repurposer.getSupportedPlatforms().filter(p => p !== platform);
        const result = await this.repurposer.repurpose(contentInput, platform, targetPlatforms);
        return result.repurposedContent;
    }
    async crossPost(content, sourcePlatform, targetPlatforms, options) {
        return this.repurposer.repurpose(content, sourcePlatform, targetPlatforms, options);
    }
    getRepurposer() {
        return this.repurposer;
    }
}
//# sourceMappingURL=ContentRepurposer.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseAiCommand = void 0;
const WHITESPACE = /\s+/g;
const normalizePrompt = (prompt) => prompt.replace(WHITESPACE, " ").trim();
const detectTranslationTarget = (prompt) => {
    const toMatch = prompt.match(/\btranslate(?:\s+this|\s+it)?\s+to\s+([a-z][a-z\s-]{1,40})/i);
    if (!toMatch)
        return undefined;
    const target = toMatch[1]?.trim();
    return target || undefined;
};
const parseAiCommand = (input) => {
    const normalizedPrompt = normalizePrompt(input.prompt);
    const lower = normalizedPrompt.toLowerCase();
    let commandType = input.commandHint ?? "GENERAL";
    if (/\bsummarize\b|\bsummary\b|\btl;dr\b/.test(lower)) {
        commandType = "SUMMARIZE";
    }
    else if (/\bexplain\b|\bclarify\b/.test(lower)) {
        commandType = "EXPLAIN";
    }
    else if (/\btranslate\b/.test(lower)) {
        commandType = "TRANSLATE";
    }
    const translateTo = (input.translateTo?.trim() || detectTranslationTarget(normalizedPrompt)) ?? undefined;
    return {
        normalizedPrompt,
        commandType,
        translateTo,
    };
};
exports.parseAiCommand = parseAiCommand;

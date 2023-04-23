import { englishDictionary, portugueseDictionary } from "./dictionary";

export type LanguageType = "english" | "portuguese" | "farsi" | "japanese";

function loadEnglishWords(): string[] {
  return englishDictionary;
}
function loadPortugueseWords(): string[] {
  return portugueseDictionary;
}

function countFarsiCharacters(text: string): number {
  return text.match(/[\u0600-\u06FF]/g)?.length || 0;
}
function countJapaneseCharacters(text: string): number {
  return text.match(/[\u3040-\u30FF]/g)?.length || 0;
}
function countEnglishCharacters(text: string): number {
  const englishWords = loadEnglishWords();
  return text
    .split(" ")
    .reduce(
      (count, word) =>
        count + (englishWords.includes(word.toLowerCase()) ? word.length : 0),
      0
    );
}
function countPortugueseCharacters(text: string): number {
  const portugueseWords = loadPortugueseWords();
  return text
    .split(" ")
    .reduce(
      (count, word) =>
        count +
        (portugueseWords.includes(word.toLowerCase()) ? word.length : 0),
      0
    );
}

export default function classifyLanguage(text: string): LanguageType {
  const languages: LanguageType[] = [
    "english",
    "portuguese",
    "japanese",
    "farsi",
  ];
  const languageCharacters = [
    countEnglishCharacters(text) * 1,
    countPortugueseCharacters(text) * 4, // the portuguese dictionary has only 1000 words compared to 50000 in english, so we multiply by 4 to compensate.
    countJapaneseCharacters(text) * 2,
    countFarsiCharacters(text),
  ];

  if (languageCharacters[2] > 0 && languageCharacters[3] > 0 && false)
    console.log("text", text, "language scores", languageCharacters);

  const index = languageCharacters.indexOf(Math.max(...languageCharacters));
  return languages[index];
}

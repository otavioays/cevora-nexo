const replacements: Array<[RegExp, string]> = [
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[E-MAIL REMOVIDO]"],
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF REMOVIDO]"],
  [/\b\d{2}\.?\d{3}\.?\d{3}\/\d{4}-?\d{2}\b/g, "[CNPJ REMOVIDO]"],
  [/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?(?:9\s*)?\d{4}[-.\s]?\d{4}\b/g, "[TELEFONE REMOVIDO]"],
  [/https?:\/\/\S+/gi, "[LINK REMOVIDO]"],
];

export function anonymizeForExternalAi(value: string) {
  return replacements.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), value);
}

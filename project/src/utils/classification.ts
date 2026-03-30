export const keywordMap: Record<string, string[]> = {
  "Labour Law": [
    "salary",
    "wage",
    "fired",
    "termination",
    "employment",
    "employer",
    "job",
    "pf",
    "provident",
    "notice period",
    "layoff",
    "resignation",
    "dismissal",
    "workplace",
    "overtime",
    "bonus",
  ],
  "Family Law": [
    "divorce",
    "custody",
    "marriage",
    "wife",
    "husband",
    "alimony",
    "separation",
    "domestic",
    "child support",
    "maintenance",
    "matrimonial",
    "spouse",
  ],
  "Property Law": [
    "property",
    "land",
    "flat",
    "house",
    "rent",
    "landlord",
    "tenant",
    "possession",
    "registry",
    "estate",
    "real estate",
    "lease",
    "eviction",
    "title",
  ],
  "Criminal Law": [
    "fir",
    "police",
    "arrest",
    "bail",
    "case",
    "complaint",
    "theft",
    "assault",
    "murder",
    "criminal",
    "crime",
    "investigation",
    "chargesheet",
  ],
  "Consumer Law": [
    "cheque",
    "fraud",
    "scam",
    "refund",
    "consumer",
    "product",
    "defective",
    "bank",
    "loan",
    "credit card",
    "transaction",
    "purchase",
  ],
};

export function classifyIssue(text: string): string | null {
  const lowerText = text.toLowerCase();

  const matches: { category: string; count: number }[] = [];

  for (const [category, keywords] of Object.entries(keywordMap)) {
    const count = keywords.filter((keyword) =>
      lowerText.includes(keyword.toLowerCase())
    ).length;

    if (count > 0) {
      matches.push({ category, count });
    }
  }

  if (matches.length === 0) return null;

  matches.sort((a, b) => b.count - a.count);

  return matches[0].category;
}

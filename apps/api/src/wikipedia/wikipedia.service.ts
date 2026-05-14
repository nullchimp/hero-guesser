import { Inject, Injectable, Optional } from "@nestjs/common";
import { AppConfigService } from "../config/app-config.service.js";
import { WikipediaArticleRecord } from "../conversations/conversation.types.js";

const SUMMARY_BASE_URL = "https://en.wikipedia.org/api/rest_v1/page/summary";
const SEARCH_URL = "https://en.wikipedia.org/w/rest.php/v1/search/page";
const HERO_TERMS = [
  "superhero",
  "supervillain",
  "super-villain",
  "comic book",
  "comics",
  "dc comics",
  "marvel comics",
  "fictional character",
  "masked vigilante",
  "antihero",
  "villain"
];

export const WIKIPEDIA_FETCH = Symbol("WIKIPEDIA_FETCH");

@Injectable()
export class WikipediaService {
  constructor(
    private readonly config: AppConfigService,
    @Optional()
    @Inject(WIKIPEDIA_FETCH)
    private readonly fetchFn: typeof fetch = fetch
  ) {}

  async enrichGuess(name: string, wikipediaSearchTitle = name): Promise<WikipediaArticleRecord | null> {
    const requestedTitle = normalizeWhitespace(wikipediaSearchTitle || name);
    const direct = await this.fetchSummary(requestedTitle);

    if (isSpecificHeroArticle(direct, name, requestedTitle)) {
      return toArticleRecord(direct);
    }

    for (const result of await this.searchCandidateTitles(requestedTitle)) {
      const summary = await this.fetchSummary(result);

      if (isSpecificHeroArticle(summary, name, requestedTitle)) {
        return toArticleRecord(summary);
      }
    }

    return null;
  }

  private async searchCandidateTitles(title: string): Promise<string[]> {
    const query = encodeURIComponent(`${title} comics character`);
    const response = await this.fetchJson<SearchResponse>(`${SEARCH_URL}?q=${query}&limit=8`);

    if (response === null || !Array.isArray(response.pages)) {
      return [];
    }

    return response.pages
      .map((page) => page.title)
      .filter((candidate): candidate is string => typeof candidate === "string");
  }

  private async fetchSummary(title: string): Promise<SummaryResponse | null> {
    const encodedTitle = encodeURIComponent(title)
      .replace(/\(/g, "%28")
      .replace(/\)/g, "%29");
    return this.fetchJson<SummaryResponse>(`${SUMMARY_BASE_URL}/${encodedTitle}`);
  }

  private async fetchJson<T>(input: string | URL): Promise<T | null> {
    const response = await this.fetchFn(input, {
      headers: {
        "Api-User-Agent": this.config.wikipediaUserAgent,
        "User-Agent": this.config.wikipediaUserAgent
      }
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  }
}

interface SearchResponse {
  pages?: Array<{
    title?: unknown;
  }>;
}

interface SummaryResponse {
  content_urls?: {
    desktop?: {
      page?: unknown;
    };
  };
  description?: unknown;
  extract?: unknown;
  namespace?: {
    id?: unknown;
  };
  originalimage?: ImageResponse;
  thumbnail?: ImageResponse;
  title?: unknown;
  type?: unknown;
}

interface ImageResponse {
  height?: unknown;
  source?: unknown;
  width?: unknown;
}

function isSpecificHeroArticle(
  summary: SummaryResponse | null,
  name: string,
  requestedTitle: string
): summary is SummaryResponse {
  if (summary === null) {
    return false;
  }

  if (summary.type !== "standard" || summary.namespace?.id !== 0) {
    return false;
  }

  if (typeof summary.title !== "string" || typeof summary.extract !== "string") {
    return false;
  }

  if (readImage(summary) === null || readPageUrl(summary) === null) {
    return false;
  }

  if (!titleLooksRelated(summary.title, name, requestedTitle)) {
    return false;
  }

  const searchable = [
    summary.title,
    typeof summary.description === "string" ? summary.description : "",
    summary.extract
  ].join(" ").toLowerCase();

  return HERO_TERMS.some((term) => searchable.includes(term));
}

function toArticleRecord(summary: SummaryResponse): WikipediaArticleRecord {
  const image = readImage(summary);
  const pageUrl = readPageUrl(summary);

  if (image === null || pageUrl === null) {
    throw new Error("Cannot serialize an incomplete Wikipedia article.");
  }

  return {
    extract: typeof summary.extract === "string" ? summary.extract : "",
    imageHeight: typeof image.height === "number" ? image.height : null,
    imageUrl: image.source,
    imageWidth: typeof image.width === "number" ? image.width : null,
    title: typeof summary.title === "string" ? summary.title : "",
    url: pageUrl
  };
}

function readImage(summary: SummaryResponse): { height: unknown; source: string; width: unknown } | null {
  const image = summary.originalimage ?? summary.thumbnail;

  if (image === undefined || typeof image.source !== "string" || image.source.length === 0) {
    return null;
  }

  return {
    height: image.height,
    source: image.source,
    width: image.width
  };
}

function readPageUrl(summary: SummaryResponse): string | null {
  const page = summary.content_urls?.desktop?.page;
  return typeof page === "string" && page.length > 0 ? page : null;
}

function titleLooksRelated(title: string, name: string, requestedTitle: string): boolean {
  const normalizedTitle = normalizeTitle(title);
  const normalizedName = normalizeTitle(name);
  const normalizedRequestedTitle = normalizeTitle(requestedTitle);

  return (
    normalizedTitle.includes(normalizedName) ||
    normalizedName.includes(normalizedTitle) ||
    normalizedTitle.includes(normalizedRequestedTitle) ||
    normalizedRequestedTitle.includes(normalizedTitle)
  );
}

function normalizeTitle(value: string): string {
  return normalizeWhitespace(value)
    .replace(/\([^)]*\)/g, "")
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

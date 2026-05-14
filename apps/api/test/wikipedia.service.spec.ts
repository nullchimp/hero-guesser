import { AppConfigService } from "../src/config/app-config.service.js";
import { WikipediaService } from "../src/wikipedia/wikipedia.service.js";

describe("WikipediaService", () => {
  it("accepts a specific superhero article with a lead image", async () => {
    const wikipedia = new WikipediaService(fakeConfig(), fakeFetch({
      "summary/Batman": summary({
        description: "DC Comics superhero",
        extract: "Batman is a superhero who appears in American comic books.",
        title: "Batman"
      })
    }));

    await expect(wikipedia.enrichGuess("Batman", "Batman")).resolves.toMatchObject({
      imageUrl: "https://upload.wikimedia.org/Batman.jpg",
      title: "Batman",
      url: "https://en.wikipedia.org/wiki/Batman"
    });
  });

  it("rejects disambiguation pages and missing-image pages", async () => {
    const wikipedia = new WikipediaService(fakeConfig(), fakeFetch({
      "summary/Flash": summary({
        description: "disambiguation page",
        extract: "Flash may refer to many subjects.",
        title: "Flash",
        type: "disambiguation"
      }),
      "search/page?q=Flash%20comics%20character": search([])
    }));

    await expect(wikipedia.enrichGuess("Flash", "Flash")).resolves.toBeNull();

    const noImage = new WikipediaService(fakeConfig(), fakeFetch({
      "summary/Batman": summary({
        description: "DC Comics superhero",
        extract: "Batman is a superhero who appears in American comic books.",
        image: false,
        title: "Batman"
      }),
      "search/page?q=Batman%20comics%20character": search([])
    }));

    await expect(noImage.enrichGuess("Batman", "Batman")).resolves.toBeNull();
  });

  it("falls back to search results to choose a specific comics character page", async () => {
    const wikipedia = new WikipediaService(fakeConfig(), fakeFetch({
      "summary/Flash": summary({
        description: "disambiguation page",
        extract: "Flash may refer to many subjects.",
        title: "Flash",
        type: "disambiguation"
      }),
      "search/page?q=Flash%20comics%20character": search([
        { title: "Flash (photography)" },
        { title: "Flash (Barry Allen)" }
      ]),
      "summary/Flash%20%28photography%29": summary({
        description: "Lighting technique",
        extract: "A flash is a device used in photography.",
        title: "Flash (photography)"
      }),
      "summary/Flash%20%28Barry%20Allen%29": summary({
        description: "DC Comics superhero",
        extract: "The Flash is a superhero who appears in American comic books.",
        title: "Flash (Barry Allen)"
      })
    }));

    await expect(wikipedia.enrichGuess("Flash", "Flash")).resolves.toMatchObject({
      title: "Flash (Barry Allen)"
    });
  });
});

function fakeConfig(): AppConfigService {
  return {
    wikipediaUserAgent: "Hero Guesser tests"
  } as AppConfigService;
}

function fakeFetch(responses: Record<string, unknown>): typeof fetch {
  const fetchMock: typeof fetch = async (input) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    const key = Object.keys(responses)
      .sort((a, b) => b.length - a.length)
      .find((candidate) => url.includes(candidate));
    const body = key === undefined ? undefined : responses[key];

    return {
      json: async () => body,
      ok: body !== undefined,
      status: body === undefined ? 404 : 200
    } as Response;
  };

  return fetchMock;
}

function search(pages: { title: string }[]): unknown {
  return {
    pages
  };
}

function summary(input: {
  description: string;
  extract: string;
  image?: boolean;
  title: string;
  type?: string;
}): unknown {
  const encodedTitle = encodeURIComponent(input.title.replaceAll(" ", "_"));

  return {
    content_urls: {
      desktop: {
        page: `https://en.wikipedia.org/wiki/${encodedTitle}`
      }
    },
    description: input.description,
    extract: input.extract,
    namespace: {
      id: 0
    },
    originalimage: input.image === false
      ? undefined
      : {
          height: 406,
          source: `https://upload.wikimedia.org/${input.title}.jpg`,
          width: 245
        },
    title: input.title,
    type: input.type ?? "standard"
  };
}

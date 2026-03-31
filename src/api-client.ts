import axios, { AxiosError, AxiosInstance, AxiosResponse } from "axios";
import type { ServerConfig } from "./config.js";

const CHARACTER_LIMIT = 25000;

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  per_page: number;
  has_more: boolean;
}

export interface SearchResult<T> {
  total: number;
  results: T[];
}

export function createApiClient(config: ServerConfig): FreshdeskClient {
  return new FreshdeskClient(config);
}

export class FreshdeskClient {
  private http: AxiosInstance;

  constructor(private config: ServerConfig) {
    this.http = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      auth: {
        username: config.apiKey,
        password: "X",
      },
    });
  }

  async get<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.http.get<T>(endpoint, { params });
    return response.data;
  }

  async getWithPagination<T>(
    endpoint: string,
    page: number,
    perPage: number,
    extraParams?: Record<string, unknown>
  ): Promise<PaginatedResult<T>> {
    const response: AxiosResponse<T[]> = await this.http.get(endpoint, {
      params: { page, per_page: perPage, ...extraParams },
    });

    const linkHeader = response.headers["link"] as string | undefined;
    const hasMore = linkHeader ? linkHeader.includes('rel="next"') : false;

    return {
      items: response.data,
      page,
      per_page: perPage,
      has_more: hasMore,
    };
  }

  async search<T>(
    resource: "tickets" | "contacts" | "companies",
    query: string,
    page: number = 1
  ): Promise<SearchResult<T>> {
    const response = await this.http.get<SearchResult<T>>(`/search/${resource}`, {
      params: { query: `"${query}"`, page },
    });
    return response.data;
  }

  async post<T>(endpoint: string, data: Record<string, unknown>): Promise<T> {
    const response = await this.http.post<T>(endpoint, data);
    return response.data;
  }

  async put<T>(endpoint: string, data: Record<string, unknown>): Promise<T> {
    const response = await this.http.put<T>(endpoint, data);
    return response.data;
  }

  async delete(endpoint: string): Promise<void> {
    await this.http.delete(endpoint);
  }
}

export function handleApiError(error: unknown): string {
  if (error instanceof AxiosError) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as Record<string, unknown> | undefined;
      const freshdeskErrors = data?.errors;

      let detail = "";
      if (Array.isArray(freshdeskErrors)) {
        detail = freshdeskErrors
          .map((e: Record<string, string>) => `${e.field}: ${e.message}`)
          .join("; ");
      } else if (data?.description) {
        detail = String(data.description);
      }

      switch (status) {
        case 400:
          return `Error: Bad request.${detail ? ` ${detail}` : ""} Check your parameters.`;
        case 401:
          return "Error: Authentication failed. Check your FRESHDESK_API_KEY.";
        case 403:
          return "Error: Permission denied. Your API key may lack the required permissions.";
        case 404:
          return "Error: Resource not found. Check the ID is correct.";
        case 409:
          return `Error: Conflict.${detail ? ` ${detail}` : ""}`;
        case 429: {
          const retryAfter = error.response.headers["retry-after"];
          return `Error: Rate limit exceeded.${retryAfter ? ` Retry after ${retryAfter}s.` : ""}`;
        }
        default:
          return `Error: Freshdesk API returned status ${status}.${detail ? ` ${detail}` : ""}`;
      }
    } else if (error.code === "ECONNABORTED") {
      return "Error: Request timed out. Please try again.";
    } else if (error.code === "ENOTFOUND") {
      return "Error: Could not reach Freshdesk. Check your FRESHDESK_DOMAIN.";
    }
  }
  return `Error: ${error instanceof Error ? error.message : String(error)}`;
}

export function truncateResponse(text: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  return (
    text.slice(0, CHARACTER_LIMIT) +
    "\n\n... [Response truncated. Use pagination or filters to narrow results.]"
  );
}

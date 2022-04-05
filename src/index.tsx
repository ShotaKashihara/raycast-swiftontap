import { ActionPanel, Action, List, showToast, Toast } from "@raycast/api";
import { useState, useEffect, useRef, useCallback } from "react";
import fetch, { AbortError } from "node-fetch";

export default function Command() {
  const { state, search } = useSearch();

  return (
    <List
      isLoading={state.isLoading}
      onSearchTextChange={search}
      searchBarPlaceholder="Search SwiftUI views..."
      throttle
    >
      <List.Section title="Results" subtitle={state.results.length + ""}>
        {state.results.map((searchResult) => (
          <List.Item
            icon={{ source: icon(searchResult.type) }}
            title={searchResult.title}
            subtitle={searchResult.description}
            accessoryTitle={searchResult.type}
            actions={
              <ActionPanel>
                <ActionPanel.Section>
                  <Action.OpenInBrowser title="Open in Browser" url={"https://swiftontap.com/" + searchResult.path} />
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}

function useSearch() {
  const [state, setState] = useState<SearchState>({ results: [], isLoading: true });
  const cancelRef = useRef<AbortController | null>(null);

  const search = useCallback(
    async function search(searchText: string) {
      cancelRef.current?.abort();
      cancelRef.current = new AbortController();
      setState((oldState) => ({
        ...oldState,
        isLoading: true,
      }));
      try {
        const results = await performSearch(searchText, cancelRef.current.signal);
        setState((oldState) => ({
          ...oldState,
          results: results,
          isLoading: false,
        }));
      } catch (error) {
        setState((oldState) => ({
          ...oldState,
          isLoading: false,
        }));

        if (error instanceof AbortError) {
          return;
        }

        console.error("search error", error);
        showToast({ style: Toast.Style.Failure, title: "Could not perform search", message: String(error) });
      }
    },
    [cancelRef, setState]
  );

  useEffect(() => {
    search("");
    return () => {
      cancelRef.current?.abort();
    };
  }, []);

  return {
    state: state,
    search: search,
  };
}

async function performSearch(searchText: string, signal: AbortSignal): Promise<SearchResult[]> {
  const params = new URLSearchParams();
  params.append("q", searchText.length === 0 ? "@raycast/api" : searchText);

  const response = await fetch("https://api.swiftontap.com/search", {
    method: "post",
    signal: signal,
    body: JSON.stringify({ q: searchText })
  });

  const json = (await response.json()) as
    | {
      hits: {
        title: string;
        description: string;
        path: string;
        type: string;
        score: string;
      }[];
      status: string;
    };

  if (!response.ok) {
    throw new Error(response.statusText);
  }

  return json.hits.map((result) => {
    return {
      title: result.title,
      description: result.description,
      path: result.path,
      type: result.type,
      score: result.score,
    };
  });
}

interface SearchState {
  results: SearchResult[];
  isLoading: boolean;
}

interface SearchResult {
  title: string;
  description: string;
  path: string;
  type: string;
  score: string;
}

function icon(type: string): string {
  const icons: { [name: string]: string } = {
    "Associated Type": "At",
    "Class": "C",
    "Case": "Ca",
    "Enumeration": "E",
    "Instance Method": "F",
    "Initializer": "I",
    "Protocol": "Pr",
    "Structure": "S",
    "Type Alias": "Ta",
    "Type Property": "V",
  };
  return `https://swiftontap.com/assets/images/symbol-icons/${icons[type]}.svg`
}
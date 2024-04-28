"use client";

// React essentials
import { useEffect, useState, useRef, useCallback } from "react";

// Next.js theme hook for managing dark/light mode
import { useTheme } from "next-themes";

// Monaco editor imports for code editor functionality
import Editor from "@monaco-editor/react";
import { useMonaco } from "@monaco-editor/react";

// Custom hooks and components for handling AI completions and UI elements
import { useCompletion } from "ai/react";
import { CircularSpinner } from "@/components/circular-spinner"; // CircularSpinner is a custom loading spinner component
import { CompletionFormatter } from "@/components/editor/completion-formatter";
import { GenerateInstructions } from "@/components/editor/prompt";

interface TextEditorProps {
  // language: Specifies the programming language for the editor. It must be one of the predefined options (although you can add more if you want)
  language: "javascript" | "typescript" | "python" | "java" | "c";
  cacheSize?: number;
  refreshInterval?: number;
}

const TextEditor = ({
  language,
  cacheSize = 10, // Default cache size for suggestions
  refreshInterval = 500, // Default refresh interval in milliseconds
}: TextEditorProps) => {
  // Hook to access the Monaco editor instance
  const monaco = useMonaco();

  // Ref to store the current instance of the editor
  const editorRef = useRef<any>(null);

  // Refs to manage fetching and timing of suggestions
  const fetchSuggestionsIntervalRef = useRef<number | undefined>(undefined);
  const timeoutRef = useRef<number | undefined>(undefined);

  // State to cache suggestions received from the AI completion API
  const [cachedSuggestions, setCachedSuggestions] = useState<any[]>([]);

  // Custom hook to manage AI completions, initialized with the API path and body content
  const { completion, stop, complete } = useCompletion({
    api: "/api/completion",
    body: {
      language: language, // Use the language prop from TextEditorProps
    },
  });

  const debouncedSuggestions = useCallback(() => {
    // Access the current model (document) of the editor
    const model = monaco?.editor.getModels()[0];

    if (!model || !model.getValue()) {
      setCachedSuggestions([]);
      return;
    }

    const position = editorRef.current.getPosition();
    const currentLine = model.getLineContent(position.lineNumber);
    const offset = model.getOffsetAt(position);
    const textBeforeCursor = model
      .getValue()
      .substring(0, offset - currentLine.length);
    const textBeforeCursorOnCurrentLine = currentLine.substring(
      0,
      position.column - 1,
    );

    if (!textBeforeCursor) return;

    const messages = [
      GenerateInstructions(language),
      {
        content: textBeforeCursor,
        role: "user",
        name: "TextBeforeCursor",
      },
      {
        content: textBeforeCursorOnCurrentLine,
        role: "user",
        name: "TextBeforeCursorOnCurrentLine",
      },
    ];

    // Call the completion API and handle the response
    complete("", {
      body: {
        messages,
      },
    })
      .then((newCompletion) => {
        if (newCompletion) {
          // Construct a new suggestion object based on the API response
          const newSuggestion = {
            insertText: newCompletion,
            range: {
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber:
                // Calculate the number of new lines in the completion text and add it to the current line number
                position.lineNumber + (newCompletion.match(/\n/g) || []).length,
              // If the suggestion is on the same line, return the length of the completion text
              endColumn: position.column + newCompletion.length,
            },
          };

          // Update the cached suggestions with the new suggestion (up to the cache size limit)
          // Cache size is set to 6 by default, which I found to be a good balance between performance and usability
          setCachedSuggestions((prev) =>
            [...prev, newSuggestion].slice(-cacheSize),
          );
        }
      })
      .catch((error) => {
        console.error("error", error);
      });
  }, [monaco, complete, setCachedSuggestions, language, cacheSize]);

  const startOrResetFetching = useCallback(() => {
    // Check if the fetching interval is not already set
    if (fetchSuggestionsIntervalRef.current === undefined) {
      // Immediately invoke suggestions once
      debouncedSuggestions();

      // Set an interval to fetch suggestions every refresh interval
      // (default is 500ms which seems to align will with the
      // average typing speed and latency of OpenAI API calls)
      fetchSuggestionsIntervalRef.current = setInterval(
        debouncedSuggestions,
        refreshInterval,
      ) as unknown as number; // Cast to number as setInterval returns a NodeJS.Timeout in Node environments
    }

    // Clear any previous timeout to reset the timer
    clearTimeout(timeoutRef.current);

    // Set a new timeout to stop fetching suggestions if no typing occurs for 2x the refresh interval
    timeoutRef.current = setTimeout(() => {
      if (fetchSuggestionsIntervalRef.current !== undefined) {
        window.clearInterval(fetchSuggestionsIntervalRef.current);
        fetchSuggestionsIntervalRef.current = undefined;
      }
    }, refreshInterval * 2) as unknown as number;
  }, [debouncedSuggestions, refreshInterval]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      // Clear the interval and timeout when the component is unmounted
      window.clearInterval(fetchSuggestionsIntervalRef.current);
      window.clearTimeout(timeoutRef.current);
    };
  }, []);

  // Use the editor change event to trigger fetching of suggestions
  const handleEditorChange = useCallback(() => {
    startOrResetFetching();
  }, [startOrResetFetching]);

  useEffect(() => {
    if (!monaco) return;

    // Register a provider for inline completions specific to the language used in the editor
    const provider = monaco.languages.registerInlineCompletionsProvider(
      language,
      {
        provideInlineCompletions: async (model, position) => {
          // Filter cached suggestions to include only those that start with the current word at the cursor position
          const suggestions = cachedSuggestions.filter((suggestion) =>
            suggestion.insertText.startsWith(
              model.getValueInRange(suggestion.range),
            ),
          );

          // Further filter suggestions to ensure they are relevant to the current cursor position within the line
          const localSuggestions = suggestions.filter(
            (suggestion) =>
              suggestion.range.startLineNumber == position.lineNumber &&
              suggestion.range.startColumn >= position.column - 3,
          );

          // Avoid providing suggestions if the character before the cursor is not a letter, number, or whitespace
          if (
            !/[a-zA-Z0-9\s]/.test(model.getValue().charAt(position.column - 2))
          ) {
            return {
              items: [],
            };
          }

          return {
            items: localSuggestions.map((suggestion) =>
              new CompletionFormatter(model, position).format(
                suggestion.insertText,
                suggestion.range,
              ),
            ),
          };
        },
        freeInlineCompletions: () => {},
      },
    );

    return () => provider.dispose();
  }, [monaco, completion, stop, cachedSuggestions, language]);

  return (
    <Editor
      height="90vh"
      defaultLanguage={language}
      defaultValue="# Start typing..."
      loading={<CircularSpinner />}
      theme={useTheme().resolvedTheme === "dark" ? "vs-dark" : "vs"}
      options={{
        autoClosingBrackets: "never",
        autoClosingQuotes: "never",
        formatOnType: true,
        formatOnPaste: true,
        trimAutoWhitespace: true,
      }}
      onChange={handleEditorChange}
      onMount={(editor, monaco) => {
        editorRef.current = editor;
      }}
    />
  );
};

export default TextEditor;

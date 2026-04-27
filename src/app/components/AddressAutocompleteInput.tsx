import { useEffect, useState } from 'react';
import { suggestAddresses, type DadataAddressSuggestion } from '../api/client';

interface AddressAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  disabled?: boolean;
  maxLength?: number;
  className?: string;
}

export function AddressAutocompleteInput({
  value,
  onChange,
  placeholder = 'Адрес доставки',
  rows = 1,
  required = false,
  disabled = false,
  maxLength = 500,
  className = ''
}: AddressAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<DadataAddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const query = value.trim();
    if (query.length < 3 || disabled) {
      setSuggestions([]);
      setIsLoading(false);
      setError('');
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        setIsLoading(true);
        setError('');
        const response = await suggestAddresses(query);
        if (!cancelled) {
          setSuggestions(response);
        }
      } catch {
        if (!cancelled) {
          setSuggestions([]);
          setError('Не удалось получить подсказки адреса');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [disabled, value]);

  const inputClassName = `w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-primary disabled:bg-gray-50 disabled:cursor-not-allowed ${className}`.trim();

  return (
    <div className="relative">
      {rows > 1 ? (
        <textarea
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => {
            window.setTimeout(() => setShowSuggestions(false), 150);
          }}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          required={required}
          disabled={disabled}
          className={`${inputClassName} resize-none`}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => {
            window.setTimeout(() => setShowSuggestions(false), 150);
          }}
          placeholder={placeholder}
          maxLength={maxLength}
          required={required}
          disabled={disabled}
          autoComplete="off"
          className={inputClassName}
        />
      )}

      {showSuggestions && (isLoading || suggestions.length > 0 || error) && (
        <div className="absolute z-20 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
          {isLoading && <p className="px-4 py-3 text-sm text-gray-500">Подбираем адрес...</p>}

          {!isLoading && error && <p className="px-4 py-3 text-sm text-amber-700 bg-amber-50">{error}</p>}

          {!isLoading && !error && suggestions.length === 0 && (
            <p className="px-4 py-3 text-sm text-gray-500">Ничего не найдено</p>
          )}

          {!isLoading &&
            !error &&
            suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.unrestricted_value || suggestion.value}-${index}`}
                type="button"
                onMouseDown={() => {
                  onChange(suggestion.unrestricted_value || suggestion.value);
                  setShowSuggestions(false);
                }}
                className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 border-t border-gray-100 first:border-t-0"
              >
                {suggestion.unrestricted_value || suggestion.value}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

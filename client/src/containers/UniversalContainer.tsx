import { useUniversalSearch } from "../hooks/useUniversalSearch";
import { UniversalSearchInput } from "../components/search/UniversalSearchInput";

export const UniversalContainer = () => {
  const {
    query,
    setQuery,
    submit,
    onKeyDown,
    sections,
    showResults,
    emptyMessage,
    activeIndex,
    setActiveIndex,
    selectResult,
    isListening,
    voiceError,
    startVoiceInput,
    stopVoiceInput,
  } = useUniversalSearch();

  return (
    <div>
      <div>
        <UniversalSearchInput
          value={query}
          onChange={setQuery}
          onSubmit={() => {
            void submit();
          }}
          onKeyDown={onKeyDown}
          sections={sections}
          showResults={showResults}
          emptyMessage={emptyMessage}
          activeIndex={activeIndex}
          onActiveIndexChange={setActiveIndex}
          onSelectResult={(result) => {
            void selectResult(result);
          }}
          isListening={isListening}
          voiceError={voiceError}
          onStartVoice={startVoiceInput}
          onStopVoice={stopVoiceInput}
        />
      </div>
    </div>
  );
};

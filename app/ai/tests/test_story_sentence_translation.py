from app.core.config import settings
from app.schemas.storyboard import StorySentenceTranslationRequest
from app.services.story_sentence_translation_service import translate_story_sentences


def setup_function() -> None:
    settings.OPENAI_API_KEY = None


def test_local_story_sentence_translation_returns_story_sentence_shape() -> None:
    request = StorySentenceTranslationRequest(
        koreanText="해솔이는 바닷가에서 조용히 웃었어요. 작은 햇살이 발끝을 따라왔어요!"
    )

    response = translate_story_sentences(request)

    assert response.sentenceCount == 2
    assert response.wordCount > 0
    assert response.koreanText == " ".join(sentence.koreanText for sentence in response.sentences)
    assert response.englishText == " ".join(sentence.englishText for sentence in response.sentences)
    assert [sentence.sentenceOrder for sentence in response.sentences] == [1, 2]
    assert all(sentence.emotion == "WARM" for sentence in response.sentences)

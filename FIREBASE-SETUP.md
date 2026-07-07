# JOURNAL 댓글 기능 — Firebase 설정 가이드

JOURNAL 글 하단의 댓글은 Google Firebase(Firestore)를 사용합니다.
아래 절차는 한 번만 하면 되고, 약 10분 정도 걸립니다. **무료 요금제(Spark)로 충분합니다.**

> 설정을 완료하기 전에는 글 하단에 "댓글 기능은 준비 중입니다"라고만 표시되며,
> 사이트의 다른 기능은 모두 정상 동작합니다.

## 1. Firebase 프로젝트 만들기

1. https://console.firebase.google.com 접속 → Google 계정으로 로그인
2. **프로젝트 만들기** 클릭 → 이름은 `gahyun-cho` 등 자유롭게
3. Google 애널리틱스는 **사용 안 함**으로 진행 (필요 없음)

## 2. Firestore 데이터베이스 만들기

1. 왼쪽 메뉴 **빌드 → Firestore Database** → **데이터베이스 만들기**
2. 위치(리전): **asia-northeast3 (Seoul)** 선택
3. **프로덕션 모드**로 시작 (규칙은 다음 단계에서 붙여넣음)

## 3. 보안 규칙 붙여넣기

Firestore 화면 상단의 **규칙(Rules)** 탭에 아래 내용을 통째로 붙여넣고 **게시**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /comments/{commentId} {
      // 누구나 읽을 수 있고, 새 댓글 작성만 가능 (수정·삭제 불가)
      allow read: if true;
      allow create: if request.resource.data.keys().hasOnly(['postId', 'name', 'message', 'createdAt'])
        && request.resource.data.postId is string
        && request.resource.data.postId.size() > 0
        && request.resource.data.postId.size() <= 100
        && request.resource.data.name is string
        && request.resource.data.name.size() > 0
        && request.resource.data.name.size() <= 20
        && request.resource.data.message is string
        && request.resource.data.message.size() > 0
        && request.resource.data.message.size() <= 800
        && request.resource.data.createdAt == request.time;
      allow update, delete: if false;
    }
    // 그 외 모든 문서는 접근 금지
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

이 규칙이 하는 일:
- 댓글 **읽기는 누구나**, **쓰기는 새 댓글 작성만** 허용
- 이름 20자, 내용 800자 제한을 서버에서도 강제
- 방문자가 남의 댓글을 **수정하거나 지울 수 없음**

## 4. 웹 앱 등록하고 설정값 받기

1. 콘솔 왼쪽 위 **⚙(프로젝트 설정) → 일반** 탭
2. 아래 "내 앱"에서 **웹(`</>`)** 아이콘 클릭 → 앱 닉네임 자유롭게 → **앱 등록**
   (Firebase 호스팅 체크는 필요 없음)
3. 화면에 나오는 `firebaseConfig` 안의 값 6개를 복사

## 5. 사이트에 붙여넣기

[js/firebase-config.js](js/firebase-config.js) 파일을 열어 `"여기에-붙여넣기"` 부분을
4번에서 복사한 실제 값으로 바꿔 저장 → 배포(push)하면 끝.

> `apiKey`는 비밀번호가 아니라 **공개되어도 되는 식별자**입니다.
> 실제 보안은 3번의 규칙이 담당하므로 사이트 코드에 넣어도 안전합니다.

## 댓글 관리 (삭제)

부적절한 댓글은 Firebase 콘솔에서 삭제합니다:
**Firestore Database → 데이터 탭 → `comments` 컬렉션** → 해당 문서 선택 → 삭제(휴지통 아이콘)

각 댓글 문서에는 `postId`(어느 글의 댓글인지), `name`, `message`, `createdAt`이 저장됩니다.

## 이미 적용되어 있는 스팸 방지 장치

- 봇이 걸려드는 숨은 입력칸(honeypot)
- 같은 브라우저에서 30초 이내 연속 등록 제한
- 이름 20자 / 내용 800자 제한 (화면 + 서버 규칙 이중 적용)
- 댓글 내용은 항상 일반 텍스트로만 표시 (스크립트 삽입 불가)

## 새 글 올리는 방법 (참고)

[js/journal-posts.js](js/journal-posts.js) 파일 맨 위 배열에 새 항목을 추가하면 됩니다.
자세한 형식은 그 파일 상단 주석 참고. 현재 들어 있는 두 편은 **예시 글**이므로
실제 글로 교체해 주세요.

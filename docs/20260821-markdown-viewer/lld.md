# 하위 설계 문서 (LLD)

## 1. 개요
이 LLD는 마크다운 뷰어 애플리케이션의 구현 세부사항을 설명합니다. 컴포넌트 구조, 데이터 흐름 및 기술 결정 사항을 포함합니다.

## 2. 컴포넌트 구조

### 2.1 메인 페이지 컴포넌트 (`app/page.tsx`)
- **위치**: `/Users/dante/dev-workspace/md-viewer/app/page.tsx`
- **책임**:
  - 애플리케이션 상태 관리
  - 마크다운 파일 선택 처리
  - 하위 컴포넌트에 콘텍스트 제공
- **구현 세부사항**:
  - React 상태를 사용하여 콘텐츠 관리
  - `/docs` 디렉터리에서 마크다운 파일을 로드하기 위해 `useEffect` 사용
  - 파일 선택 기능 제공

```typescript
// 상태 구조
const [selectedFile, setSelectedFile] = useState<string | null>(null);
const [markdownContent, setMarkdownContent] = useState<string>('');
const [renderedContent, setRenderedContent] = useState<string>('');
```

### 2.2 네비게이션 바 컴포넌트
- **위치**: `/Users/dante/dev-workspace/md-viewer/app/components/Navbar.tsx`
- **책임**:
  - 애플리케이션 로고 표시
  - 파일 작업을 위한 작업 버튼 제공
- **구현 세부사항**:
  - Tailwind CSS를 사용하여 스타일링
  - Tooltip 컴포넌트로 버튼 아이콘 구현
  - 콜백을 통해 버튼 클릭 처리

```tsx
interface NavbarProps {
  onOpen: () => void;
  onRefresh: () => void;
  onSave: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onOpen, onRefresh, onSave }) => {
  return (
    <nav className="fixed top-0 w-full bg-white shadow-md z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex-shrink-0">
            <Logo />
          </div>
          <div className="flex items-center space-x-4">
            <button onClick={onOpen} className="p-2">
              <OpenIcon />
            </button>
            <button onClick={onRefresh} className="p-2">
              <RefreshIcon />
            </button>
            <button onClick={onSave} className="p-2">
              <SaveIcon />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};
```

### 2.3 마크다운 뷰어 컴포넌트 (`app/components/MarkdownViewer.tsx`)
- **위치**: `/Users/dante/dev-workspace/md-viewer/app/components/MarkdownViewer.tsx`
- **책임**:
  - 스플릿 팬 인터페이스 표시
  - 마크다운 소스 에디터 제공
  - 마크다운 미리보기 렌더링
  - 전체 화면 토글 처리
- **구현 세부사항**:
  - `remark`와 `remark-html`을 사용하여 마크다운 파싱
  - 코드 편집을 위한 React Code Mirror(또는 유사한) 컴포넌트 사용
  - 반응형 스플릿 팬 레이아웃 구현

```tsx
interface MarkdownViewerProps {
  content: string;
  onContentChange: (content: string) => void;
}

const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content, onContentChange }) => {
  // 마크다운을 HTML로 파싱
  const renderedContent = useMemo(() => {
    return remark().use(remarkHtml).processSync(content).toString();
  }, [content]);

  const [isFullScreen, setIsFullScreen] = useState(false);

  return (
    <div className="flex h-[calc(100vh-64px)] mt-16 overflow-hidden">
      <div className="w-1/2 overflow-auto">
        <CodeEditor value={content} onChange={onContentChange} />
      </div>
      <div className={`flex-1 overflow-auto ${isFullScreen ? 'fixed inset-0 z-40 bg-white' : ''}`}>
        <div className="p-4">
          <div className="flex justify-end mb-2">
            <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-2">
              {isFullScreen ? <ExitFullScreenIcon /> : <FullScreenIcon />}
            </button>
          </div>
          <div dangerouslySetInnerHTML={{ __html: renderedContent }} />
        </div>
      </div>
    </div>
  );
};
```

## 3. 데이터 흐름

### 3.1 파일 로딩
1. 사용자가 애플리케이션을 열면
2. `app/page.tsx`의 `useEffect`가 파일 시스템 읽기를 트리거합니다
3. `/docs` 디렉터리에서 마크다운 파일 목록을 검색합니다
4. 파일 목록은 상태에 저장됩니다

```typescript
useEffect(() => {
  const loadFiles = async () => {
    const files = await listMarkdownFiles();
    setFiles(files);
  };
  loadFiles();
}, []);
```

### 3.2 마크다운 렌더링
1. 사용자가 마크다운 파일을 선택하면
2. 파일 콘텐츠가 상태에 로드됩니다
3. 콘텐츠 변경은 `remark`와 `remarkHtml`을 통해 마크다운 파싱을 트리거합니다
4. 파싱된 HTML은 상태에 저장됩니다
5. 렌더링된 콘텐츠는 미리보기 패널에 표시됩니다

```typescript
const renderedContent = useMemo(() => {
  return remark().use(remarkHtml).processSync(content).toString();
}, [content]);
```

### 3.3 사용자 작업
1. **열기**: 파일 선택 대화 상자를 트리거
2. **새로고침**: 현재 파일 콘텐츠를 새로 로드
3. **저장**: 마크다운 콘텐츠를 유효성 검사하고 파일 시스템에 저장
4. **전체 화면**: 미리보기 패널의 전체 화면 모드 토글

## 4. 상태 관리

### 4.1 애플리케이션 상태
- **selectedFile**: 현재 선택된 마크다운 파일 경로
- **markdownContent**: 선택된 파일의 원시 마크다운 콘텐츠
- **renderedContent**: 마크다운 콘텐츠의 HTML 표현
- **files**: 사용 가능한 마크다운 파일 목록
- **isFullScreen**: 전체 화면 모드 상태를 나타내는 불리언 플래그

```typescript
interface AppState {
  selectedFile: string | null;
  markdownContent: string;
  renderedContent: string;
  files: string[];
  isFullScreen: boolean;
}
```

## 5. 기술 결정

### 5.1 마크다운 처리
- `remark`를 사용하여 마크다운 파싱
- `remark-html`을 사용하여 마크다운을 HTML로 변환
- 성능 최적화를 위해 `useMemo`에서 마크다운 처리

### 5.2 코드 편집
- 마크다운 편집을 위한 React Code Mirror 컴포넌트 사용
- 코드 미러가 너무 무거울 경우 간단한 `textarea`와 커스텀 스타일링 사용

### 5.3 스타일링
- 유니버셜 스타일링을 위해 Tailwind CSS 사용
- 재사용 가능한 UI 요소를 위한 커스텀 컴포넌트 생성

### 5.4 파일 작업
- 클라이언트 사이드 파일 작업만 지원
- 기본 기능에는 백엔드 필요 없음
- 브라우저의 File API를 사용하여 파일 선택 및 저장

## 6. 에러 처리

### 6.1 파일 로딩
- `/docs` 디렉터리가 존재하지 않을 때의 에러 처리
- 마크다운 파일이 유효하지 않을 때의 에러 처리
- 사용자 친화적인 오류 메시지 표시

### 6.2 마크다운 렌더링
- 잘못된 마크다운 문법을 처리
- 렌더링 실패 시 폴백 표시 제공

### 6.3 저장 작업
- 파일 콘텐츠를 저장하기 전에 유효성 검사
- 기존 파일을 저장할 때 덮어쓰기 확인
- 성공/오류 알림 사용자에게 표시

## 7. 테스팅 전략

### 7.1 단위 테스트
- 다양한 입력으로 마크다운 파싱 테스트
- 렌더링 시의 엣지 케이스 테스트
- 다른 상태에서 컴포넌트 렌더링 테스트

### 7.2 통합 테스트
- 파일 선택 및 로딩 흐름 테스트
- 편집과 렌더링 함께 테스트
- 네비게이션 바 기능 테스트

### 7.3 종단 간 테스트
- 완전한 사용자 워크플로우 테스트
- 오류 시나리오 테스트
- 반응형 동작 테스트

## 8. 성능 최적화

### 8.1 마크다운 렌더링
- 불필요한 재렌더링을 피하기 위해 렌더링된 콘텐츠를 메모이제이션
- 타이핑 중 콘텐츠 업데이트를 쓰로틀

### 8.2 파일 로딩
- 초기 로드 시에만 파일 목록을 가져옴
- 클라이언트 사이드에서 파일 콘텐츠 캐시

### 8.3 렌더링
- 긴 문서에 대한 가상화 사용
- 미리보기 패널의 DOM 업데이트 최적화

## 9. 접근성 고려사항

### 9.1 키보드 네비게이션
- 모든 작업에 대한 키보드 단축키 지원
- 전체 화면 모드 중 포커스 관리 보장

### 9.2 스크린 리더
- 버튼과 컨트롤에 적절한 ARIA 라벨 제공
- 문서 구조의 논리적 읽기 순서 보장

### 9.3 반응형 디자인
- 다양한 화면 크기에 맞춘 레이아웃 조정
- 모바일, 태블릿, 데스크톱에서 테스트

---

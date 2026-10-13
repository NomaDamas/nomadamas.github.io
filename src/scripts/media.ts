// ClientRouter는 다음 페이지 HTML을 DOMParser로 읽은 뒤 화면에 붙인다.
// 그 문서 안에서 <video>, <audio>가 불러오기를 시도하다 실패해 소스 없음 상태로 들어오고,
// 화면에 붙은 뒤에는 다시 불러오지 않는다. 새로고침 전까지 영상이 비어 있으므로 다시 불러온다.
document.addEventListener("astro:after-swap", () => {
  for (const media of document.querySelectorAll<HTMLMediaElement>(
    "video, audio"
  )) {
    // transition:persist로 이전 페이지에서 옮겨 온 요소는 재생 중일 수 있어 건드리지 않는다.
    if (media.closest("[data-astro-transition-persist]")) continue;
    media.load();
  }
});

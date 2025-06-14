import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    // useLayoutEffect는 DOM 변경 전에 동기적으로 실행됨
    
    // 방법 1: 모든 스크롤 가능한 요소 리셋
    const resetAllScrolls = () => {
      // 윈도우 스크롤 리셋
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'auto'
      });
      
      // HTML과 Body 직접 리셋
      if (document.documentElement) {
        document.documentElement.scrollTop = 0;
        document.documentElement.scrollLeft = 0;
      }
      
      if (document.body) {
        document.body.scrollTop = 0;
        document.body.scrollLeft = 0;
      }

      // 모든 스크롤 가능한 요소 찾아서 리셋
      const scrollableElements = document.querySelectorAll('[data-scroll]');
      scrollableElements.forEach(el => {
        el.scrollTop = 0;
        el.scrollLeft = 0;
      });
    };

    // 즉시 실행
    resetAllScrolls();

    // 다음 프레임에서도 실행 (더 확실하게)
    requestAnimationFrame(() => {
      resetAllScrolls();
      
      // 한 번 더 실행
      requestAnimationFrame(() => {
        resetAllScrolls();
      });
    });

  }, [pathname]);

  return null;
};

export default ScrollToTop; 
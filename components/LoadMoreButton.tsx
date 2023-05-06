import LoadingSpinner from "@/components/LoadingSpinner";
import { useRef } from "react";

export function LoadMoreButton(props: {
  loadMore: () => void;
  loading: boolean;
}) {
  const { loadMore, loading } = props;

  const buttonRef = useRef<HTMLButtonElement>(null);

  const lastLoadRef = useRef<number>(Date.now());
  const loadingRef = useRef<boolean>(false);
  loadingRef.current = loading;

  // const onWindowChange = () => {
  //   if (buttonRef.current) {
  //     let top = null;
  //     let bottom = null;

  //     top = buttonRef.current.getBoundingClientRect().top;
  //     bottom = buttonRef.current.getBoundingClientRect().bottom;

  //     const windowHeight = window.innerHeight;
  //     if (top !== null && bottom !== null) {
  //       if (
  //         top < windowHeight - 8 &&
  //         !loadingRef.current &&
  //         Date.now() - lastLoadRef.current > 20000
  //       ) {
  //         loadMore();
  //         lastLoadRef.current = Date.now();
  //       }
  //     }
  //   }
  // };
  // useEffect(() => {
  //   if (typeof window !== undefined) {
  //     window.addEventListener("resize", onWindowChange);
  //     window.addEventListener("scroll", onWindowChange);

  //     return () => {
  //       window.removeEventListener("resize", onWindowChange);
  //       window.removeEventListener("scroll", onWindowChange);
  //     };
  //   }
  // }, []);

  return (
    <button
      className={
        "w-full h-16 dark:bg-slate-700 bg-slate-100 text-base flex flex-row items-center justify-center unselectable outline-none " +
        (loading
          ? "dark:text-slate-300 text-slate-500"
          : "dark:text-slate-50 text-slate-800")
      }
      onClick={() => {
        if (!loading) {
          lastLoadRef.current = Date.now();
          loadMore();
        }
      }}
      ref={buttonRef}
    >
      {loading ? (
        <LoadingSpinner
          containerClassName="w-6 h-6 mr-2"
          dotClassName="bg-slate-800 dark:bg-slate-400"
        />
      ) : (
        <span className="material-icons text-2xl mr-2">add</span>
      )}
      Load more
    </button>
  );
}

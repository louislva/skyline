export default function LoadingSpinner(props: {
  containerClassName?: string;
  dotClassName?: string;
}) {
  const { containerClassName, dotClassName } = props;

  return (
    <div className={"lds-grid " + containerClassName}>
      <div className={dotClassName}></div>
      <div className={dotClassName}></div>
      <div className={dotClassName}></div>
      <div className={dotClassName}></div>
      <div className={dotClassName}></div>
      <div className={dotClassName}></div>
      <div className={dotClassName}></div>
      <div className={dotClassName}></div>
      <div className={dotClassName}></div>
    </div>
  );
}

export function LoadingPlaceholder() {
  return (
    <div className="flex flex-row justify-center items-center text-3xl py-32">
      <LoadingSpinner
        containerClassName="w-12 h-12 mr-4"
        dotClassName="bg-slate-800 dark:bg-slate-400"
      />
      <div className="text-slate-800 dark:text-slate-400">Loading...</div>
    </div>
  );
}

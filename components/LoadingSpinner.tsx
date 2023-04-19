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

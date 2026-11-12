const formatNumber = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 6 });

export function hasDeliveryMeasure(objective) {
  return objective?.target_value != null && Number.isFinite(Number(objective.target_value)) && Number(objective.target_value) > 0
    && objective.achieved_value != null && Number.isFinite(Number(objective.achieved_value)) && Number(objective.achieved_value) >= 0;
}

export default function DeliveryMeasure({ objective, chart = false }) {
  const actual = Number(objective.achieved_value);
  const target = Number(objective.target_value);
  const scale = Math.max(actual, target);
  const unit = objective.target_unit ? " " + objective.target_unit : "";
  return <div className={chart ? "delivery-measure is-chart" : "delivery-measure"}>
    <h3>{objective.name}</h3>
    {chart ? [["Target", target], ["Actual", actual]].map(([label, value]) =>
      <div className="measure-bar-row" key={label}>
        <span>{label}</span>
        <span className={label === "Actual" ? "measure-track is-actual" : "measure-track"} aria-hidden="true">
          <i style={{ width: (100 * value / scale) + "%" }} />
        </span>
        <strong>{formatNumber.format(value)}{unit}</strong>
      </div>) : <>
      <div className="measure-value">{formatNumber.format(actual)} <small>of {formatNumber.format(target)}{unit}</small></div>
      <progress value={actual} max={scale} aria-label={"Recorded result for " + objective.name} />
      {objective.measure && <p>{objective.measure}</p>}
    </>}
  </div>;
}

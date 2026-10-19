import { useMemo, useState } from "react";
import { ShieldAlert, Search, RefreshCw } from "lucide-react";

export default function Alerts({ analysis, onInvestigate }) {
    const [filterRows, setFilterRows] = useState([]);
    const [matchMode, setMatchMode] = useState("all");
    const [appliedFilters, setAppliedFilters] = useState([]);
    const [appliedMatchMode, setAppliedMatchMode] = useState("all");
    const [sortBy, setSortBy] = useState("probability-desc");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Only show flows classified as botnet.
    const availableValues = (field) => [
        ...new Set(
            (analysis?.results || [])
                .filter((item) => {
                    const prediction = String(item.prediction || "").toLowerCase();
                    return prediction === "botnet" || item.class_id === 1;
                })
                .map((item) => item.flow?.[field])
                .filter((value) => value !== null && value !== undefined && value !== "")
                .map(String)
        ),
    ].sort();

    const protocols = availableValues("Proto");
    const directions = availableValues("Dir");
    const connectionStates = availableValues("State");

    const alerts = useMemo(() => {
        const results = analysis?.results || [];

        const botnetAlerts = results.filter((item) => {
            const prediction = String(item.prediction || "").toLowerCase();
            return prediction === "botnet" || item.class_id === 1;
        });

        if (appliedFilters.length === 0) {
            return [...botnetAlerts].sort((a, b) => {
                const probabilityA = a.probabilities?.botnet ?? -1;
                const probabilityB = b.probabilities?.botnet ?? -1;

                if (sortBy === "probability-asc") return probabilityA - probabilityB;
                if (sortBy === "row-asc") return Number(a.row) - Number(b.row);
                if (sortBy === "row-desc") return Number(b.row) - Number(a.row);

                return probabilityB - probabilityA;
            });
        }

        const filteredAlerts = botnetAlerts.filter((item) => {
            const flow = item.flow || {};

            const matches = appliedFilters.map((condition) => {
                const { feature, value } = condition;
                if (!feature || value === "") return true;

                let actualValue;

                switch (feature) {
                    case "row":
                        actualValue = item.row;
                        break;
                    case "Sport":
                    case "Dport":
                    case "Proto":
                    case "Dir":
                    case "State":
                        actualValue = flow[feature];
                        break;
                    case "probabilityBand": {
                        const probability = item.probabilities?.botnet;

                        if (probability == null) {
                            actualValue = "Unknown";
                        } else if (probability >= 0.8) {
                            actualValue = "High";
                        } else if (probability >= 0.5) {
                            actualValue = "Medium";
                        } else {
                            actualValue = "Low";
                        }
                        break;
                    }
                    default:
                        return true;
                }

                return String(actualValue ?? "").toLowerCase() ===
                    String(value).toLowerCase();
            });

            return appliedMatchMode === "all"
                ? matches.every(Boolean)
                : matches.some(Boolean);
        });        
        const getProbability = (item) =>
            item.probabilities?.botnet ?? -1;

        return [...filteredAlerts].sort((a, b) => {
            switch (sortBy) {
                case "probability-asc":
                    return getProbability(a) - getProbability(b);
                case "row-asc":
                    return Number(a.row) - Number(b.row);
                case "row-desc":
                    return Number(b.row) - Number(a.row);
                case "probability-desc":
                default:
                    return getProbability(b) - getProbability(a);
            }
        });
    }, [analysis, appliedFilters, appliedMatchMode, sortBy]);

    const totalPages = Math.max(1, Math.ceil(alerts.length / pageSize));

    const paginatedAlerts = alerts.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );
    
    const highProbabilityCount = alerts.filter(
        (item) => item.probabilities?.botnet >= 0.8
    ).length;


    const totalAlerts = (analysis?.results || []).filter((item) => {
        const prediction = String(item.prediction || "").toLowerCase();
        return prediction === "botnet" || item.class_id === 1;
    }).length;

    const withProbability = alerts.filter(
        (item) => item.probabilities?.botnet != null
    );

    const probabilityBandCounts = useMemo(() => {
        const counts = {
            High: 0,
            Medium: 0,
            Low: 0,
            Unknown: 0,
        };

        for (const item of alerts) {
            const probability = item.probabilities?.botnet;

            if (probability == null) {
                counts.Unknown++;
            } else if (probability >= 0.8) {
                counts.High++;
            } else if (probability >= 0.5) {
                counts.Medium++;
            } else {
                counts.Low++;
            }
        }

        return counts;
    }, [alerts]);

    const averageProbability = withProbability.length
        ? withProbability.reduce(
            (sum, item) => sum + item.probabilities.botnet,
            0
        ) / withProbability.length
        : null;

    return (
        <section className="page">
        <div className="page-heading">
            <div>
                <div className="eyebrow">SECURITY MONITORING</div>
                <h1>Detection Alerts</h1>
                <p>
                    Review network flows classified as botnet by the Random Forest
                    model.
                </p>
            </div>

            <button
                className="secondary-button"
                onClick={() => {
                    setSearch("");
                    setFilter("All");
                }}
            >
                <RefreshCw size={16} />
                Reset filters
            </button>
        </div>

        {!analysis && (
            <div className="notice">
                <ShieldAlert size={19} />
                <div>
                    <strong>No analysis results available</strong>
                    <p>
                        Upload a CSV in Dataset Manager first. Botnet predictions will
                        appear here after classification.
                    </p>
                </div>
            </div>
        )}

        <div className="metrics-grid">
            <div className="metric-card">
                <div className="metric-label">Botnet alerts</div>
                <div className="metric-value">{totalAlerts.toLocaleString()}</div>
                <div className="metric-note">Across the latest analysis</div>
            </div>

            <div className="metric-card">
                <div className="metric-label">Visible alerts</div>
                <div className="metric-value">{alerts.length.toLocaleString()}</div>
                <div className="metric-note">Matching current filters</div>
            </div>

            <div className="metric-card">
                <div className="metric-label">Average botnet probability</div>
                <div className="metric-value">
                    {averageProbability == null
                    ? "—"
                    : `${(averageProbability * 100).toFixed(2)}%`}
                </div>
                <div className="metric-note">
                    Based on visible alerts with probabilities
                </div>
            </div>
        </div>

        <div className="metrics-grid">
            <div className="metric-card">
                <div className="metric-label">High probability</div>
                <div className="metric-value">
                    {probabilityBandCounts.High.toLocaleString()}
                </div>
                <div className="metric-note">80% and above</div>
            </div>

            <div className="metric-card">
                <div className="metric-label">Medium probability</div>
                <div className="metric-value">
                    {probabilityBandCounts.Medium.toLocaleString()}
                </div>
                <div className="metric-note">50% to below 80%</div>
            </div>

            <div className="metric-card">
                <div className="metric-label">Low probability</div>
                <div className="metric-value">
                    {probabilityBandCounts.Low.toLocaleString()}
                </div>
                <div className="metric-note">Below 50%</div>
            </div>

            <div className="metric-card">
                <div className="metric-label">Unknown probability</div>
                <div className="metric-value">
                    {probabilityBandCounts.Unknown.toLocaleString()}
                </div>
                <div className="metric-note">Probability unavailable</div>
            </div>
        </div>

        <section className="panel">
            <div className="panel-heading">
                <div>
                    <h2>Botnet flow alerts</h2>
                    <p>Search and filter the model's detections.</p>
                </div>
            </div>
                        
            <div className="alert-filter-panel">
                <div className="alert-filter-heading">
                    <div>
                        <h3>Filter botnet alerts</h3>
                        <p>Match conditions to narrow down the results.</p>
                    </div>

                    <select
                        value={matchMode}
                        onChange={(event) => setMatchMode(event.target.value)}
                        aria-label="How to match filter conditions"
                    >
                        <option value="all">Match All</option>
                        <option value="any">Match Any</option>
                    </select>
                </div>

                <div className="alert-filter-rows">
                    {filterRows.map((row) => {
                        const options = {
                            Proto: protocols,
                            Dir: directions,
                            State: connectionStates,
                            probabilityBand: ["High", "Medium", "Low", "Unknown"],
                        };

                        const dropdownFeature = Object.hasOwn(options, row.feature);

                        return (
                            <div className="alert-filter-row" key={row.id}>
                                <select
                                    aria-label="Filter feature"
                                    value={row.feature}
                                    onChange={(event) => {
                                        const feature = event.target.value;

                                        setFilterRows((previous) =>
                                            previous.map((item) =>
                                                item.id === row.id
                                                    ? {
                                                        ...item,
                                                        feature,
                                                        value: "",
                                                    }
                                                    : item
                                            )
                                        );
                                    }}
                                >
                                    <option value="Proto">Protocol</option>
                                    <option value="Dir">Direction</option>
                                    <option value="State">Connection state</option>
                                    <option value="Sport">Source port</option>
                                    <option value="Dport">Destination port</option>
                                    <option value="row">CSV row</option>
                                    <option value="probabilityBand">Probability band</option>
                                </select>

                                <span className="alert-filter-operator">is</span>

                                {dropdownFeature ? (
                                    <select
                                        aria-label={`Value for ${row.feature}`}
                                        value={row.value}
                                        onChange={(event) =>
                                            setFilterRows((previous) =>
                                                previous.map((item) =>
                                                    item.id === row.id
                                                        ? { ...item, value: event.target.value }
                                                        : item
                                                )
                                            )
                                        }
                                    >
                                        <option value="">Select a value</option>
                                        {options[row.feature].map((value) => (
                                            <option key={value} value={value}>
                                                {value}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        aria-label={`Value for ${row.feature}`}
                                        type="text"
                                        value={row.value}
                                        onChange={(event) =>
                                            setFilterRows((previous) =>
                                                previous.map((item) =>
                                                    item.id === row.id
                                                        ? { ...item, value: event.target.value }
                                                        : item
                                                )
                                            )
                                        }
                                        placeholder={
                                            row.feature === "Sport"
                                                ? "Source port"
                                                : row.feature === "Dport"
                                                ? "Destination port"
                                                : "CSV row number"
                                        }
                                    />
                                )}

                                <button
                                    type="button"
                                    className="alert-remove-filter"
                                    aria-label="Remove filter"
                                    onClick={() =>
                                        setFilterRows((previous) =>
                                            previous.filter((item) => item.id !== row.id)
                                        )
                                    }
                                >
                                    −
                                </button>
                            </div>
                        );
                    })}
                </div>

                <button
                    type="button"
                    className="alert-add-filter"
                    onClick={() =>
                        setFilterRows((previous) => [
                            ...previous,
                            {
                                id: `${Date.now()}-${previous.length}`,
                                feature: "Proto",
                                value: "",
                            },
                        ])
                    }
                >
                    + Add filter
                </button>

                <div className="alert-filter-footer">
                    <button
                        type="button"
                        className="primary-button"
                        onClick={() => {
                            setAppliedFilters(
                                filterRows.filter((row) => row.value !== "")
                            );
                            setAppliedMatchMode(matchMode);
                        }}
                    >
                        Apply filters
                    </button>

                    <button
                        type="button"
                        className="secondary-button"
                        onClick={() => {
                            setFilterRows([]);
                            setMatchMode("all");
                            setAppliedFilters([]);
                            setAppliedMatchMode("all");
                        }}
                    >
                        Reset filters
                    </button>
                </div>
            </div>
            
            <div className="alert-summary-cards">
                <div className="alert-summary-card">
                    <span>Total botnet alerts</span>
                    <strong>{alerts.length}</strong>
                    <small>Matching current filters</small>
                </div>

                <div className="alert-summary-card">
                    <span>Displayed on this page</span>
                    <strong>{paginatedAlerts.length}</strong>
                    <small>Current page only</small>
                </div>

                <div className="alert-summary-card">
                    <span>High probability</span>
                    <strong>{highProbabilityCount}</strong>
                    <small>Botnet probability ≥ 80%</small>
                </div>
            </div>

            <div className="alert-sort-control">
                <label htmlFor="alert-sort">Sort by</label>
                <select
                    id="alert-sort"
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value)}
                >
                    <option value="probability-desc">
                        Highest botnet probability
                    </option>
                    <option value="probability-asc">
                        Lowest botnet probability
                    </option>
                    <option value="row-asc">CSV row: ascending</option>
                    <option value="row-desc">CSV row: descending</option>
                </select>
            </div>

            <div className="table-scroll">
                <table>
                    <thead>
                        <tr>
                            <th>CSV row</th>
                            <th>Prediction</th>
                            <th>Botnet probability</th>
                            <th>Probability band</th>
                            <th>Action</th>
                        </tr>
                    </thead>

                    <tbody>
                        {alerts.length ? (
                            paginatedAlerts.map((item) => {
                                const probability = item.probabilities?.botnet;

                                const band =
                                    probability == null
                                    ? "Unknown"
                                    : probability >= 0.8
                                    ? "High"
                                    : probability >= 0.5
                                    ? "Medium"
                                    : "Low";

                                return (
                                    <tr key={item.row}>
                                        <td>{item.row ?? "—"}</td>
                                        <td>
                                            <span className="alert-label">
                                                <ShieldAlert size={15} />
                                                {item.prediction || "Botnet"}
                                            </span>
                                        </td>
                                        <td>
                                            {probability == null
                                            ? "—"
                                            : `${(probability * 100).toFixed(2)}%`}
                                        </td>
                                        <td>
                                            <span className={`subtle-tag alert-band-${band.toLowerCase()}`}>
                                                {band}
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                className="secondary-button"
                                                onClick={() => onInvestigate?.(item.row)}
                                                disabled={item.row == null}
                                            >
                                                Investigate
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan="5" className="empty-table">
                                    {analysis
                                    ? "No botnet alerts match these filters."
                                    : "No results yet. Upload and classify a CSV in Dataset Manager."}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            <div className="alert-pagination">
                <div className="alert-pagination-info">
                    Showing{" "}
                    {alerts.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                    {"–"}
                    {Math.min(currentPage * pageSize, alerts.length)}
                    {" of "}
                    {alerts.length} alerts
                </div>

                <div className="alert-pagination-controls">
                    <label htmlFor="alert-page-size">Rows per page</label>
                    <select
                        id="alert-page-size"
                        value={pageSize}
                        onChange={(event) => {
                            setPageSize(Number(event.target.value));
                            setCurrentPage(1);
                        }}
                    >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                    </select>

                    <button
                        type="button"
                        disabled={currentPage <= 1}
                        onClick={() =>
                            setCurrentPage((page) => Math.max(1, page - 1))
                        }
                    >
                        Previous
                    </button>

                    <span>
                        Page {currentPage} of {totalPages}
                    </span>

                    <button
                        type="button"
                        disabled={currentPage >= totalPages}
                        onClick={() =>
                            setCurrentPage((page) => Math.min(totalPages, page + 1))
                        }
                    >
                        Next
                    </button>
                </div>
            </div>

        </section>

        <p className="alert-disclaimer">
            Alerts represent model predictions, not confirmed malicious activity.
            Probability bands are display filters and are not calibrated severity
            ratings.
        </p>
        </section>
    );
}
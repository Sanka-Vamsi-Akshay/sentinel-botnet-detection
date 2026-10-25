import { useEffect, useMemo, useState } from "react";

const formatValue = (value) => {
    if (value === null || value === undefined || value === "") {
        return "—";
    }

    if (typeof value === "object") {
        return JSON.stringify(value);
    }

    return String(value);
};

const formatProbability = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return "—";
    }

    return `${(Number(value) * 100).toFixed(2)}%`;
};

export default function FlowInvestigation({ analysis, selectedRow: requestedRow }) {
    const [selectedRow, setSelectedRow] = useState(null);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    const results = analysis?.results ?? [];

    const filteredResults = useMemo(() => {
        const query = search.trim().toLowerCase();

        return results.filter((item) => {
            const matchesFilter =
                filter === "all" ||
                (filter === "botnet" && item.prediction === "botnet") ||
                (filter === "normal" && item.prediction === "normal");

            const flowText = JSON.stringify(item.flow ?? {}).toLowerCase();
            const matchesSearch =
                !query ||
                String(item.row).includes(query) ||
                item.prediction?.toLowerCase().includes(query) ||
                flowText.includes(query);

            return matchesFilter && matchesSearch;
        });
    }, [results, search, filter]);

    const totalPages = Math.max(
        1,
        Math.ceil(filteredResults.length / pageSize)
    );

    const paginatedResults = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredResults.slice(start, start + pageSize);
    }, [filteredResults, currentPage, pageSize]);

    const startItem =
        filteredResults.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;

    const endItem = Math.min(
        currentPage * pageSize,
        filteredResults.length
    );

    const activeFlow =
        filteredResults.find((item) => item.row === selectedRow) ??
        results.find((item) => item.row === selectedRow) ??
        null;
    
    useEffect(() => {
        if (requestedRow != null) {
            setSelectedRow(requestedRow);
        }
    }, [requestedRow]);

    if (!analysis || !Array.isArray(analysis.results)) {
        return (
            <section className="page">
                <h1>Flow Investigation</h1>
                <p>
                    No batch analysis is available yet. Upload a CSV in Dataset Manager
                    and run classification to investigate its flows.
                </p>
            </section>
        );
    }

    return (
        <section className="page">
            <header className="page-header">
                <div>
                    <h1>Flow Investigation</h1>
                    <p>
                        Inspect individual classified flows and review their original CSV
                        fields.
                    </p>
                </div>
                <div className="investigation-summary">
                    <span>{analysis.total_flows ?? results.length} flows analyzed</span>
                    <span>{analysis.counts?.botnet ?? 0} predicted botnet</span>
                </div>
            </header>

            <div className="investigation-layout">
                <section className="investigation-list">
                    <div className="investigation-controls">
                        <input
                            value={search}
                            onChange={(event) => {
                                setSearch(event.target.value);
                                setCurrentPage(1);
                            }}
                            placeholder="Search row, prediction, IP, protocol..."
                            aria-label="Search flows"
                        />

                        <select
                            value={filter}
                            onChange={(event) => {
                                setFilter(event.target.value);
                                setCurrentPage(1);
                            }}
                            aria-label="Filter prediction"
                        >
                            <option value="all">All predictions</option>
                            <option value="botnet">Predicted botnet</option>
                            <option value="normal">Predicted normal</option>
                        </select>
                    </div>

                    <div className="flow-list">
                        {paginatedResults.map((item) => (
                            <button
                                type="button"
                                key={item.row}
                                className={`flow-list-item ${
                                    selectedRow === item.row ? "selected" : ""
                                }`}
                                onClick={() => setSelectedRow(item.row)}
                            >
                                <span className="flow-row-title">
                                    Flow #{item.row}
                                    <span
                                        className={`prediction-badge ${item.prediction}`}
                                    >
                                        {item.prediction}
                                    </span>
                                </span>

                                <span className="flow-row-subtitle">
                                    {formatValue(item.flow?.Proto)} ·{" "}
                                    {formatValue(item.flow?.Sport)} →{" "}
                                    {formatValue(item.flow?.Dport)}
                                </span>

                                <span className="flow-row-subtitle">
                                    Botnet probability:{" "}
                                    {formatProbability(item.probabilities?.botnet)}
                                </span>
                            </button>
                        ))}

                        {filteredResults.length === 0 && (
                            <p className="empty-state">No flows match these filters.</p>
                        )}
                    </div>
                    <div className="pagination-controls">
                        <span>
                            Showing {startItem}–{endItem} of {filteredResults.length} flows
                        </span>

                        <label>
                            Rows per page:
                            <select
                                value={pageSize}
                                onChange={(event) => {
                                    setPageSize(Number(event.target.value));
                                    setCurrentPage(1);
                                }}
                            >
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </label>

                        <button
                            type="button"
                            disabled={currentPage <= 1}
                            onClick={() => setCurrentPage((page) => page - 1)}
                        >
                            Previous
                        </button>

                        <span>
                            Page {currentPage} of {totalPages}
                        </span>

                        <button
                            type="button"
                            disabled={currentPage >= totalPages}
                            onClick={() => setCurrentPage((page) => page + 1)}
                        >
                            Next
                        </button>
                    </div>
                </section>

                <section className="flow-detail-panel">
                    {!activeFlow ? (
                        <div className="empty-state">
                        <h2>Select a flow</h2>
                        <p>Choose a row from the list to inspect its details.</p>
                        </div>
                    ) : (
                        <>
                            <div className="detail-heading">
                                <div>
                                    <h2>Flow #{activeFlow.row}</h2>
                                    <p>Classification result and source record</p>
                                </div>
                                <span
                                    className={`prediction-badge ${activeFlow.prediction}`}
                                >
                                    Predicted {activeFlow.prediction}
                                </span>
                            </div>

                            <div className="probability-grid">
                                <div className="probability-card">
                                    <span>Botnet probability</span>
                                    <strong>
                                        {formatProbability(activeFlow.probabilities?.botnet)}
                                    </strong>
                                </div>
                                <div className="probability-card">
                                    <span>Normal probability</span>
                                    <strong>
                                        {formatProbability(activeFlow.probabilities?.normal)}
                                    </strong>
                                </div>
                                <div className="probability-card">
                                    <span>Class ID</span>
                                    <strong>{formatValue(activeFlow.class_id)}</strong>
                                </div>
                            </div>

                            <h3>Original flow fields</h3>
                            <div className="flow-fields-table-wrap">
                                <table className="flow-fields-table">
                                    <thead>
                                        <tr>
                                            <th>Field</th>
                                            <th>Original value</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(activeFlow.flow ?? {}).map(
                                            ([field, value]) => (
                                                <tr key={field}>
                                                    <td>{field}</td>
                                                    <td>{formatValue(value)}</td>
                                                </tr>
                                            )
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <aside className="investigation-disclaimer">
                                <strong>Interpretation note</strong>
                                <p>
                                    This view reports a machine-learning classification.
                                    A predicted botnet label or probability is not proof of
                                    malicious activity. Probabilities may not be calibrated,
                                    and the model does not establish intent or attribution.
                                    Original labels in the CSV are shown as source data only.
                                </p>
                            </aside>
                        </>
                    )}
                </section>
            </div>
        </section>
    );
}
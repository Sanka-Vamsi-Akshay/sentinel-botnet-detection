import { useEffect, useState } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

import API from "../api";

function MetricCard({ label, value }) {
    const displayValue =
        typeof value === "number" ? `${(value * 100).toFixed(2)}%` : value ?? "—";

    return (
        <div className="metric-card">
            <p className="metric-label">{label}</p>
            <h2>{displayValue}</h2>
        </div>
    );
}

export default function ModelEvaluation() {
    const [evaluation, setEvaluation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [importance, setImportance] = useState(null);
    const [importanceLoading, setImportanceLoading] = useState(false);
    const [importanceError, setImportanceError] = useState("");

    async function loadEvaluation() {
        setLoading(true);
        setError("");

        try {
            const response = await fetch(`${API}/api/model/evaluation`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || "Could not load evaluation metrics.");
            }

            setEvaluation(data);
        } catch (err) {
            setError(err.message || "Unable to connect to the backend.");
        } finally {
            setLoading(false);
        }
    }

    async function loadImportance() {
        setImportanceLoading(true);
        setImportanceError("");
    
        try {
            const response = await fetch(`${API}/api/model/feature-importance`);
            const data = await response.json();
        
            if (!response.ok) {
                throw new Error(data.detail || "Could not load feature importance.");
            }
        
            setImportance(data);
        } catch (err) {
            setImportanceError(err.message || "Unable to connect to the backend.");
        } finally {
            setImportanceLoading(false);
        }
    }

    useEffect(() => {
        loadEvaluation();
        loadImportance();
    }, []);

    if (loading) {
        return (
            <section className="page">
                <h1>Model Evaluation</h1>
                <div className="panel">Loading evaluation metrics...</div>
            </section>
        );
    }

    if (error) {
        return (
            <section className="page">
                <div className="page-heading">
                    <div>
                        <h1>Model Evaluation</h1>
                        <p>Review the Random Forest model's performance.</p>
                    </div>
                    <button className="primary-button" onClick={loadEvaluation}>
                        Retry
                    </button>
                </div>
                <div className="panel notice">{error}</div>
            </section>
        );
    }

    const matrix = evaluation.confusion_matrix || [];
    const report = evaluation.classification_report || {};

    return (
        <section className="page">
            <div className="page-heading">
                <div>
                    <h1>Model Evaluation</h1>
                    <p>Performance metrics for the trained Random Forest classifier.</p>
                </div>
                <button className="primary-button" onClick={loadEvaluation}>
                    Refresh
                </button>
            </div>

            <div className="metrics-grid">
                <MetricCard label="Accuracy" value={evaluation.accuracy} />
                <MetricCard
                    label="Botnet Precision"
                    value={evaluation.precision_botnet}
                />
                <MetricCard
                    label="Botnet Recall"
                    value={evaluation.recall_botnet}
                />
                <MetricCard
                    label="Botnet F1-Score"
                    value={evaluation.f1_botnet}
                />
            </div>

            <div className="panel">
                <div className="panel-heading">
                    <div>
                        <h2>Evaluation Method</h2>
                        <p>Capture-level train/test separation</p>
                    </div>

                    <span className="subtle-tag">
                        {evaluation.test_captures?.length ?? 0} held-out captures
                    </span>
                </div>

                <div className="table-scroll">
                    <table>
                        <tbody>
                            <tr>
                                <th>Split method</th>
                                <td>
                                    {evaluation.evaluation_type ||
                                        "GroupShuffleSplit by capture"}
                                </td>
                            </tr>

                            <tr>
                                <th>Training flows</th>
                                <td>
                                    {evaluation.training_rows?.toLocaleString() ?? "—"}
                                </td>
                            </tr>

                            <tr>
                                <th>Test flows</th>
                                <td>
                                    {evaluation.test_rows?.toLocaleString() ?? "—"}
                                </td>
                            </tr>

                            <tr>
                                <th>Training captures</th>
                                <td>
                                    {evaluation.train_captures?.length ?? "—"}
                                </td>
                            </tr>

                            <tr>
                                <th>Held-out captures</th>
                                <td>
                                    {evaluation.test_captures?.length ?? "—"}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <p className="notice">
                    Evaluation uses GroupShuffleSplit by capture, so complete network
                    captures are held out from training and used for testing. This
                    measures generalization to the selected held-out CTU-13 captures,
                    but it does not establish performance on live or completely unseen
                    real-world network environments.
                </p>
            </div>

            <div className="panel">
                <div className="panel-heading">
                    <div>
                        <h2>Held-out Captures</h2>
                        <p>Complete captures reserved for model evaluation</p>
                    </div>

                    <span className="subtle-tag">
                        {evaluation.test_captures?.length ?? 0} captures
                    </span>
                </div>

                <div className="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Capture</th>
                                <th>Status</th>
                            </tr>
                        </thead>

                        <tbody>
                            {evaluation.test_captures?.length ? (
                                evaluation.test_captures.map((capture, index) => (
                                    <tr key={capture}>
                                        <td>{index + 1}</td>
                                        <td>{capture}</td>
                                        <td>Held out for testing</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="3" className="empty-table">
                                        Held-out capture information is unavailable.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="panel">
                <h2>Confusion Matrix</h2>
                <p className="subtle-tag">
                    Rows are actual classes; columns are predicted classes.
                </p>

                {matrix.length > 0 ? (
                <div className="table-scroll">
                    <table>
                        <thead>
                            <tr>
                            <th>Actual / Predicted</th>
                            <th>Normal (0)</th>
                            <th>Botnet (1)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {matrix.map((row, index) => (
                                <tr key={index}>
                                    <th>{index === 0 ? "Normal (0)" : "Botnet (1)"}</th>
                                    {row.map((value, columnIndex) => (
                                        <td key={columnIndex}>{value}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                ) : (
                    <p>Confusion matrix is unavailable.</p>
                )}
            </div>

            <div className="panel">
                <h2>Classification Report</h2>
                <div className="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>Class</th>
                                <th>Precision</th>
                                <th>Recall</th>
                                <th>F1-Score</th>
                                <th>Support</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(report)
                                .filter(
                                    ([name, values]) =>
                                        values &&
                                        typeof values === "object" &&
                                        "precision" in values &&
                                        !["accuracy"].includes(name)
                                )
                                .map(([name, values]) => (
                                    <tr key={name}>
                                        <td>{name}</td>
                                        <td>{Number(values.precision).toFixed(4)}</td>
                                        <td>{Number(values.recall).toFixed(4)}</td>
                                        <td>{Number(values["f1-score"]).toFixed(4)}</td>
                                        <td>{values.support ?? "—"}</td>
                                    </tr>
                                ))
                            }
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="panel">
                <div className="panel-heading">
                    <div>
                        <h2>Random Forest Feature Importance</h2>
                        <p>Features ranked by their contribution to the forest's splits.</p>
                    </div>
                    <button
                        className="secondary-button"
                        onClick={loadImportance}
                        disabled={importanceLoading}
                    >
                        {importanceLoading ? "Loading..." : "Refresh"}
                    </button>
                </div>

                {importanceError && (
                    <div className="notice">{importanceError}</div>
                )}

                {importanceLoading && !importance && (
                    <p>Loading feature importance...</p>
                )}

                {importance && (
                    <>
                        <p className="subtle-tag">
                            {importance.total_features} transformed features
                        </p>

                        <div style={{ width: "100%", height: 420 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={importance.features.slice(0, 10)}
                                    layout="vertical"
                                    margin={{ top: 8, right: 24, left: 110, bottom: 8 }}
                                    style={{ backgroundColor: "#162338", borderRadius: 8 }}
                                >                                    
                                    <CartesianGrid
                                        stroke="#29384e"
                                        strokeDasharray="3 3"
                                        vertical={true}
                                    />
                                    <XAxis
                                        type="number"
                                        tickFormatter={(value) => value.toFixed(3)}
                                        tick={{ fill: "#91a8c7", fontSize: 12 }}
                                        axisLine={{ stroke: "#34445b" }}
                                        tickLine={{ stroke: "#34445b" }}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="feature"
                                        width={110}
                                        tick={{ fill: "#a9bdd6", fontSize: 11 }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        formatter={(value) => Number(value).toFixed(6)}
                                        contentStyle={{
                                            backgroundColor: "#111b2d",
                                            border: "1px solid #34445b",
                                            borderRadius: "8px",
                                            color: "#e6edf7",
                                        }}
                                        labelStyle={{
                                            color: "#63e6be",
                                            fontWeight: 600,
                                        }}
                                        itemStyle={{ color: "#63e6be" }}
                                        cursor={{ fill: "rgba(56, 217, 165, 0.08)" }}
                                    />
                                    <Bar
                                        dataKey="importance"
                                        name="Importance"
                                        fill="#38D9A5"
                                        radius={[0, 5, 5, 0]}
                                        maxBarSize={26}
                                    />

                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <h3>Ranked Feature List</h3>
                        <div className="table-scroll">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Rank</th>
                                        <th>Feature</th>
                                        <th>Importance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {importance.features.map((item) => (
                                        <tr key={item.rank}>
                                            <td>{item.rank}</td>
                                            <td>{item.feature}</td>
                                            <td>{Number(item.importance).toFixed(6)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </section>
    );
}
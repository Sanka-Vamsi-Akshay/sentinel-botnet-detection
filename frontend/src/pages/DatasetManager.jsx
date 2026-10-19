import { useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react";

import API_URL from "../api";

export default function DatasetManager({ onResults, accessToken }) {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState(null);

    async function handleUpload(event) {
        event.preventDefault();

        if (!file) {
            setError("Please choose a CSV file first.");
            return;
        }

        setLoading(true);
        setError("");
        setResult(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch(`${API_URL}/api/predict/batch`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    typeof data.detail === "string"
                      ? data.detail
                      : JSON.stringify(data.detail)
                );
            }

            setResult(data);
            onResults?.(data);
        } catch (err) {
            setError(err.message || "Upload failed. Check that the backend is running.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="dataset-manager">
            <div className="page-heading">
                <div>
                    <div className="eyebrow">DATA MANAGEMENT</div>
                    <h1>Dataset Manager</h1>
                    <p>Upload a CSV of network flows for offline classification.</p>
                </div>
            </div>

            <section className="panel">
                <div className="panel-heading">
                    <div>
                        <h2>Upload network flows</h2>
                        <p>CSV files must contain all features required by the model.</p>
                    </div>
                    <FileSpreadsheet size={22} />
                </div>

                <form onSubmit={handleUpload}>
                    <label className="file-upload-button" htmlFor="flow-file">
                        <FileSpreadsheet size={18} />
                        Choose CSV file
                    </label>

                    <input
                        id="flow-file"
                        className="file-input-hidden"
                        type="file"
                        accept=".csv,text/csv"
                        onChange={(event) => {
                            setFile(event.target.files?.[0] || null);
                            setResult(null);
                            setError("");
                        }}
                    />

                    {file && (
                        <p className="metric-note">
                            Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                        </p>
                    )}

                    <button
                        className="primary-button"
                        type="submit"
                        disabled={!file || loading}
                    >
                        <Upload size={17} />
                        {loading ? "Analyzing flows..." : "Upload and analyze"}
                    </button>
                </form>

                {loading && (
                    <p className="metric-note">
                        Processing the file. Large datasets may take longer.
                    </p>
                )}

                {error && (
                    <div className="notice">
                        <AlertCircle size={19} />
                        <p>{error}</p>
                    </div>
                )}
            </section>

            {result && (
                <>
                  <div className="notice">
                      <CheckCircle size={19} />
                      <div>
                          <strong>Analysis complete</strong>
                          <p>{result.filename}</p>
                          <p>{result.total_flows} flows classified.</p>
                      </div>
                  </div>

                  <div className="metrics-grid">
                      <section className="metric-card">
                          <div className="metric-label">Total flows</div>
                          <div className="metric-value">{result.total_flows}</div>
                      </section>

                      <section className="metric-card">
                          <div className="metric-label">Predicted normal</div>
                          <div className="metric-value">{result.counts.normal}</div>
                      </section>

                      <section className="metric-card">
                          <div className="metric-label">Predicted botnet</div>
                          <div className="metric-value">{result.counts.botnet}</div>
                      </section>
                  </div>

                  <section className="panel table-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Classification results</h2>
                          <p>Predictions generated by the Random Forest model.</p>
                        </div>
                      </div>

                      <div className="table-scroll">
                          <table>
                              <thead>
                                  <tr>
                                      <th>Row</th>
                                      <th>Prediction</th>
                                      <th>Class ID</th>
                                      <th>Normal probability</th>
                                      <th>Botnet probability</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {result.results.map((item) => (
                                      <tr key={item.row}>
                                          <td>{item.row}</td>
                                          <td>
                                              <span className="subtle-tag">
                                                  {item.prediction}
                                              </span>
                                          </td>
                                          <td>{item.class_id}</td>
                                          <td>
                                              {item.probabilities?.normal != null
                                                ? `${(item.probabilities.normal * 100).toFixed(2)}%`
                                                : "—"}
                                          </td>
                                          <td>
                                              {item.probabilities?.botnet != null
                                                ? `${(item.probabilities.botnet * 100).toFixed(2)}%`
                                                : "—"}
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </section>
                </>
            )}
        </div>
    );
}
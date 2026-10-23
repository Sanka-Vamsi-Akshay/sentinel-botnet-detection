import { useEffect, useState } from "react";
import BackendStatus from "./components/BackendStatus";
import DatasetManager from "./pages/DatasetManager";
import TrafficAnalysis from "./pages/TrafficAnalysis";
import ModelEvaluation from "./pages/ModelEvaluation";
import Alerts from "./pages/Alerts";
import FlowInvestigation from "./pages/FlowInvestigation";
import Login from "./components/Login";
import {
	Activity,
	Bell,
	ChartNoAxesCombined,
	ChevronDown,
	CircleHelp,
	Database,
	LayoutDashboard,
	LogOut,
	Menu,
	Search,
	Settings,
	Shield,
	ShieldAlert,
	ShieldCheck,
	Upload,
	X,
} from "lucide-react";

import "./App.css";
import API_BASE_URL from "./api";


const navigation = [
	{ name: "Dashboard", icon: LayoutDashboard },
	{ name: "Traffic Analysis", icon: Activity },
	{ name: "Alerts", icon: Bell },
	{ name: "Flow Investigation", icon: ShieldAlert },
	{ name: "Dataset Manager", icon: Database },
	{ name: "Model Evaluation", icon: ChartNoAxesCombined },
];

function Sidebar({ page, setPage, mobileOpen, setMobileOpen, currentUser, onLogout }) {
	const [profileOpen, setProfileOpen] = useState(false);

    const email = currentUser?.email || "Signed-in user";
    const initials = email.split("@")[0].slice(0, 2).toUpperCase();
	return (
		<>
			{mobileOpen && (
				<button
					className="mobile-overlay"
					onClick={() => setMobileOpen(false)}
					aria-label="Close navigation"
				/>
			)}

			<aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
				<div className="brand">
					<div className="brand-mark">
						<ShieldCheck size={23} />
					</div>
					<div>
						<div className="brand-name">Sentinel</div>
						<div className="brand-caption">NETWORK SECURITY</div>
					</div>
					<button
						className="icon-button mobile-close"
						onClick={() => setMobileOpen(false)}
						aria-label="Close menu"
					>
						<X size={19} />
					</button>
				</div>

				<div className="workspace-label">WORKSPACE</div>

				<nav className="nav-list">
					{navigation.map((item) => {
						const Icon = item.icon;
						const active = page === item.name;

						return (
							<button
								key={item.name}
								className={`nav-item ${active ? "nav-active" : ""}`}
								onClick={() => {
									setPage(item.name);
									setMobileOpen(false);
								}}
							>
								<Icon size={19} strokeWidth={1.8} />
								<span>{item.name}</span>
								{item.name === "Alerts" && (
									<span className="nav-count">—</span>
								)}
							</button>
						);
					})}
				</nav>

				<div className="sidebar-bottom">
					<div className="help-card">
						<CircleHelp size={19} />
						<div>
							<strong>Need help?</strong>
							<p>Review project documentation.</p>
						</div>
					</div>
	
					<div className="profile-container">
						<button
							type="button"
							className="profile"
							onClick={() => setProfileOpen((open) => !open)}
							aria-expanded={profileOpen}
							aria-label="Open account menu"
						>
							<div className="avatar">{initials}</div>

							<div className="profile-text">
								<strong>{email.split("@")[0]}</strong>
								<span>{email}</span>
							</div>

							<ChevronDown
								size={16}
								className="muted"
								style={{
									transform: profileOpen ? "rotate(180deg)" : "rotate(0deg)",
									transition: "transform 0.2s ease",
									flexShrink: 0,
								}}
							/>
						</button>

						{profileOpen && (
							<div className="profile-menu">
								<div className="profile-menu-email">{email}</div>

								<button
									type="button"
									className="profile-menu-item"
									onClick={() => {
										setProfileOpen(false);
										onLogout();
									}}
								>
									<LogOut size={16} />
									<span>Sign out</span>
								</button>
							</div>
						)}
					</div>
				</div>
			</aside>
		</>
	);
}

function Header({ page, setMobileOpen }) {
	return (
		<header className="topbar">
			<div className="topbar-left">
				<button
					className="icon-button mobile-menu"
					onClick={() => setMobileOpen(true)}
					aria-label="Open navigation"
				>
					<Menu size={21} />
				</button>
				<div className="breadcrumb">
					<span>Sentinel</span>
					<span className="breadcrumb-divider">/</span>
					<strong>{page}</strong>
				</div>
			</div>

			<div className="topbar-actions">
				<div className="environment-pill">
					<span className="status-dot" />
					Offline analysis
				</div>
			</div>
		</header>
	);
}

function MetricCard({ label, value, note, icon: Icon, tone }) {
	return (
		<section className="metric-card">
			<div className="metric-top">
				<span className="metric-label">{label}</span>
				<div className={`metric-icon ${tone}`}>
					<Icon size={19} />
				</div>
			</div>
			<div className="metric-value">{value}</div>
			<div className="metric-note">{note}</div>
		</section>
	);
}

function Dashboard({ analysis, modelStatus, predictionHistory, setPage }) {
	return (
		<>
			<div className="page-heading">
				<div>
					<div className="eyebrow">OVERVIEW</div>
					<h1>Security Dashboard</h1>
					<BackendStatus />
					<p>
						Monitor network-flow analysis and review model detections.
					</p>
				</div>
			</div>

			<div className="notice">
				<Shield size={19} />
				<div>
					<strong>Offline analysis workspace</strong>
					<p>
						Upload network-flow CSV data to classify traffic with the trained Random Forest model.
						Results can be reviewed through Alerts and Flow Investigation.
					</p>
				</div>
			</div>

			<div className="metrics-grid">
				<MetricCard
					label="Flows analyzed"
					value={analysis ? analysis.total_flows.toLocaleString() : "—"}
					note={analysis ? "Flows classified in last upload" : "Awaiting dataset"}
					icon={Activity}
					tone="blue"
				/>

				<MetricCard
					label="Botnet detections"
					value={analysis ? analysis.counts.botnet.toLocaleString() : "—"}
					note={analysis ? "Predicted botnet flows" : "Awaiting model predictions"}
					icon={ShieldAlert}
					tone="red"
				/>

				<MetricCard
					label="Normal flows"
					value={analysis ? analysis.counts.normal.toLocaleString() : "—"}
					note={analysis ? "Predicted normal flows" : "Awaiting model predictions"}
					icon={ShieldCheck}
					tone="green"
				/>
				<MetricCard
					label="Model status"
					value={
						modelStatus === null
						? "Checking..."
						: modelStatus.loaded
							? "Ready"
							: "Unavailable"
					}
					note={
						modelStatus === null
						? "Checking backend"
						: modelStatus.loaded
							? "Expanded Random Forest"
							: "Model unavailable"
					}
					icon={Database}
					tone="purple"
				/>
			</div>

			<div className="content-grid">
				<section className="panel traffic-panel">
					<div className="panel-heading">
						<div>
							<h2>Traffic overview</h2>
							<p>Flow classification activity</p>
						</div>
						<span className="subtle-tag">No data</span>
					</div>

					<div className="empty-chart">
						<div className="empty-chart-icon">
							<ChartNoAxesCombined size={27} />
						</div>
						<strong>No traffic data yet</strong>
						<p>
							Upload a compatible dataset after the backend is connected
							to view traffic statistics here.
						</p>
					</div>
				</section>

				<section className="panel">
					<div className="panel-heading">
						<div>
							<h2>Detection status</h2>
							<p>Current analysis state</p>
						</div>
					</div>

					<div className="status-row">
						<span className={`status-dot ${analysis ? "" : "gray-dot"}`} />
							<div>
								<strong>Dataset</strong>
								<p>{analysis ? "Dataset analyzed" : "Not uploaded"}</p>
							</div>
							<span className="status-label">
							{analysis ? "Analyzed" : "Waiting"}
						</span>
					</div>

					<div className="status-row">
						<span
							className={`status-dot ${
								modelStatus?.loaded ? "" : "gray-dot"
							}`}
						/>
						<div>
							<strong>Classifier</strong>
							<p>
								{modelStatus?.loaded
								? "Expanded Random Forest"
								: "Random Forest"}
							</p>
						</div>
						<span className="status-label">
							{modelStatus === null
								? "Checking"
								: modelStatus.loaded
								? "Ready"
								: "Unavailable"}
						</span>
					</div>

					<div className="status-row">
						<span className={`status-dot ${analysis ? "" : "gray-dot"}`} />
						<div>
							<strong>Analysis</strong>
							<p>Offline flow processing</p>
						</div>
						<span className="status-label">
							{analysis ? "Complete" : "Idle"}
						</span>
					</div>
				</section>
			</div>

			<section className="panel table-panel">
				<div className="panel-heading">
					<div>
						<h2>Recent detections</h2>
						<p>Latest flows classified by the model</p>
					</div>
					<button className="secondary-button" onClick={() => setPage("Flow Investigation")}>
						View all
					</button>
				</div>

				<div className="table-scroll">
					<table>
						<thead>
							<tr>
								<th>CSV row</th>
								<th>Prediction</th>
								<th>Class ID</th>
								<th>Botnet probability</th>
							</tr>
						</thead>
						<tbody>
							{analysis?.results?.length ? (
								analysis.results.slice(0, 10).map((item) => (
									<tr key={item.row}>
										<td>{item.row}</td>
										<td>{item.prediction}</td>
										<td>{item.class_id}</td>
										<td>
											{item.probabilities?.botnet != null
												? `${(item.probabilities.botnet * 100).toFixed(2)}%`
												: "—"}
										</td>
									</tr>
								))
							) : (
								<tr>
									<td colSpan="4" className="empty-table">
										No analysis results yet. Upload a CSV in Dataset Manager.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</section>

			<section className="panel table-panel">
				<div className="panel-heading">
					<div>
						<h2>Recent Analysis History</h2>
						<p>Previously completed CSV analysis runs</p>
					</div>
					<span className="subtle-tag">
						{predictionHistory.length} records
					</span>
				</div>

				<div className="table-scroll">
					<table>
						<thead>
							<tr>
								<th>File</th>
								<th>Date and time</th>
								<th>Total flows</th>
								<th>Normal</th>
								<th>Botnet</th>
								<th>Model</th>
							</tr>
						</thead>
						<tbody>
							{predictionHistory.length > 0 ? (
								predictionHistory.map((item) => (
									<tr key={item.id}>
										<td>{item.filename}</td>
										<td>
											{new Date(item.created_at).toLocaleString()}
										</td>
										<td>{item.total_flows.toLocaleString()}</td>
										<td>{item.normal_count.toLocaleString()}</td>
										<td>{item.botnet_count.toLocaleString()}</td>
										<td>{item.model_name}</td>
									</tr>
								))
							) : (
								<tr>
									<td colSpan="6" className="empty-table">
										No saved analysis history found.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</section>
		</>
	);
}

export default function App() {
	const [page, setPage] = useState("Dashboard");
	const [selectedFlowRow, setSelectedFlowRow] = useState(null);
	const [mobileOpen, setMobileOpen] = useState(false);
	const [analysis, setAnalysis] = useState(null);
	const [modelStatus, setModelStatus] = useState(null);
	const [predictionHistory, setPredictionHistory] = useState([]);
	const [accessToken, setAccessToken] = useState(
		() => sessionStorage.getItem("sentinel_access_token")
	);
	const [currentUser, setCurrentUser] = useState(() => {
		const savedUser = sessionStorage.getItem("sentinel_user");

		try {
			return savedUser ? JSON.parse(savedUser) : null;
		} catch {
			return null;
		}
	});

	function handleLogout() {
		sessionStorage.removeItem("sentinel_access_token");
    	sessionStorage.removeItem("sentinel_user");

		setAccessToken(null);
		setCurrentUser(null);
		setAnalysis(null);
		setPredictionHistory([]);
		setPage("Dashboard");
		setMobileOpen(false);
	}

	function handleLogin(token, user) {
		sessionStorage.setItem("sentinel_access_token", token);
		sessionStorage.setItem("sentinel_user", JSON.stringify(user));

		setAccessToken(token);
		setCurrentUser(user);
	}

	useEffect(() => {
		const loadModelStatus = async () => {
			try {
				const response = await fetch(
					`${API_BASE_URL}/api/model/status`
				);

				if (!response.ok) {
					throw new Error("Failed to load model status");
				}

				const data = await response.json();
				setModelStatus(data);
			} catch (error) {
				console.error("Model status error:", error);
				setModelStatus({
					loaded: false,
					model_type: "Unavailable",
					model_version: null,
				});
			}
		};

		loadModelStatus();
	}, []);

	useEffect(() => {
		if (!accessToken) return;

		const loadPredictionHistory = async () => {
			try {
				const response = await fetch(
					`${API_BASE_URL}/api/prediction-history`,
					{
						headers: {
							Authorization: `Bearer ${accessToken}`,
						},
					}
				);

				if (!response.ok) {
					throw new Error("Failed to load prediction history");
				}

				const data = await response.json();
				setPredictionHistory(data.history || []);
			} catch (error) {
				console.error("Prediction history error:", error);
			}
		};

		loadPredictionHistory();
	}, [accessToken]);

	if (!accessToken) {
		return <Login onLogin={handleLogin} />;
	}
	return (
		<div className="app-shell">
			<Sidebar
				page={page}
				setPage={setPage}
				mobileOpen={mobileOpen}
				setMobileOpen={setMobileOpen}
				currentUser={currentUser}
    			onLogout={handleLogout}
			/>

			<main className="main-area">
				<Header page={page} setMobileOpen={setMobileOpen} />

				
				<div className="page-content">
					{page === "Dashboard" ? (
						<Dashboard 
						analysis={analysis} 
						modelStatus={modelStatus}
						predictionHistory={predictionHistory}
						setPage={setPage}
						/>
					) : page === "Traffic Analysis" ? (
						<TrafficAnalysis />
					) : page === "Dataset Manager" ? (
						<DatasetManager
							onResults={(data) => {
								setAnalysis(data);

								setPredictionHistory((previous) => [
									{
										id: `recent-${Date.now()}`,
										filename: data.filename,
										total_flows: data.total_flows,
										normal_count: data.counts.normal,
										botnet_count: data.counts.botnet,
										created_at: new Date().toISOString(),
										model_name: data.model || "Expanded Random Forest",
									},
									...previous,
								]);
							}}
							accessToken={accessToken}
						/>
					) : page === "Model Evaluation" ? (
						<ModelEvaluation />					
					) : page === "Alerts" ? (
						<Alerts
							analysis={analysis}
							onInvestigate={(row) => {
								setSelectedFlowRow(row);
								setPage("Flow Investigation");
							}}
						/>
					) : page === "Flow Investigation" ? (
						<FlowInvestigation
							analysis={analysis}
							selectedRow={selectedFlowRow}
						/>
					) : null}


					<footer className="footer">
						<span>Sentinel Network Security</span>
						<span>CTU-13 • Random Forest • Local workspace</span>
					</footer>
				</div>
			</main>
		</div>
	);
}
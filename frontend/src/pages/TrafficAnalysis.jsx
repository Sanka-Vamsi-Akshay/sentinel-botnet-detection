import { useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, LoaderCircle } from "lucide-react";

import API_BASE from "../api";

export default function TrafficAnalysis() {
	const [features, setFeatures] = useState([]);
	const [values, setValues] = useState({});
	const [loadingFeatures, setLoadingFeatures] = useState(true);
	const [featureError, setFeatureError] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [prediction, setPrediction] = useState(null);
	const [error, setError] = useState("");

	useEffect(() => {
		async function loadFeatures() {
			try {
				const response = await fetch(`${API_BASE}/api/model/features`);
				const data = await response.json();

				if (!response.ok) {
					throw new Error(data.detail || "Could not load model features.");
				}

				setFeatures(data.features);
				setValues(
					Object.fromEntries(
						data.features.map((feature) => [
							feature.name,
							feature.type === "number" ? "0" : "Unknown",
						])
					)
				);
			} catch (err) {
				setFeatureError(err.message || "Could not connect to the API.");
			} finally {
				setLoadingFeatures(false);
			}
		}

		loadFeatures();
	}, []);

	function updateValue(name, value) {
		setValues((current) => ({ ...current, [name]: value }));
	}

	async function handleSubmit(event) {
		event.preventDefault();
		setSubmitting(true);
		setPrediction(null);
		setError("");

		const payload = {};

		for (const feature of features) {
			const value = values[feature.name];

			if (feature.type === "number") {
				if (value.trim() === "" || !Number.isFinite(Number(value))) {
					setError(`Enter a valid number for ${feature.name}.`);
					setSubmitting(false);
					return;
				}
				payload[feature.name] = Number(value);
			} else {
				payload[feature.name] = value.trim() || "Unknown";
			}
		}

		try {
			const response = await fetch(`${API_BASE}/api/predict`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			const data = await response.json();

			if (!response.ok) {
				const detail =
				typeof data.detail === "string"
					? data.detail
					: data.detail?.message || JSON.stringify(data.detail);
				throw new Error(detail || "Prediction request failed.");
			}

			setPrediction(data);
		} catch (err) {
			setError(err.message || "Could not connect to the prediction API.");
		} finally {
			setSubmitting(false);
		}
	}

	if (loadingFeatures) {
		return (
			<div className="flex items-center gap-3 p-6 text-slate-300">
				<LoaderCircle className="h-5 w-5 animate-spin" />
				Loading model features...
			</div>
		);
	}

	if (featureError) {
		return (
			<div className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-5 text-rose-200">
				<div className="mb-2 flex items-center gap-2 font-semibold">
					<AlertTriangle className="h-5 w-5" />
					Could not load model features
				</div>
				<p className="text-sm">{featureError}</p>
				<p className="mt-2 text-sm text-slate-300">
					Check that FastAPI is running and the model status endpoint reports loaded.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-6 text-slate-100">
			<div>
				<div className="mb-2 flex items-center gap-3">
					<Activity className="h-6 w-6 text-cyan-400" />
					<h1 className="text-2xl font-semibold">Traffic Analysis</h1>
				</div>
				<p className="text-sm text-slate-400">
					Submit one network flow for offline Random Forest classification.
				</p>
			</div>

			<form
				onSubmit={handleSubmit}
				className="rounded-2xl border border-white/10 bg-slate-900/70 p-5"
			>
				<h2 className="mb-1 text-lg font-semibold">Flow features</h2>
				<p className="mb-5 text-sm text-slate-400">
					Enter values for the features used by your trained model.
					Defaults are placeholders, not captured traffic.
				</p>

				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{features.map((feature) => (
						<label key={feature.name} className="block">
							<span className="mb-2 block text-sm text-slate-300">
								{feature.name}
								<span className="ml-2 text-xs text-slate-500">
									{feature.type}
								</span>
							</span>
							<input
								type={feature.type === "number" ? "number" : "text"}
								step={feature.type === "number" ? "any" : undefined}
								value={values[feature.name] ?? ""}
								onChange={(event) =>
									updateValue(feature.name, event.target.value)
								}
								className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400"
							/>
						</label>
					))}
				</div>

				{error && (
					<div className="mt-5 rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">
						{error}
					</div>
				)}

				<button
					type="submit"
					disabled={submitting}
					className="mt-6 inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{submitting ? (
						<LoaderCircle className="h-4 w-4 animate-spin" />
					) : (
						<Activity className="h-4 w-4" />
					)}
					{submitting ? "Analyzing..." : "Analyze flow"}
				</button>
			</form>

			{prediction && (
				<section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
					<div className="mb-3 flex items-center gap-2">
						<CheckCircle2 className="h-5 w-5 text-emerald-400" />
						<h2 className="text-lg font-semibold">Prediction result</h2>
					</div>

					<p className="text-sm text-slate-400">Predicted class</p>
					<p className="mt-1 text-2xl font-bold capitalize">
						{prediction.prediction}
					</p>

					<p className="mt-2 text-sm text-slate-400">
						Model: {prediction.model} · Class ID: {prediction.class_id}
					</p>

					{prediction.probabilities && (
						<div className="mt-5 space-y-3">
							<h3 className="text-sm font-medium text-slate-300">
								Model class probabilities
							</h3>
							{Object.entries(prediction.probabilities).map(([label, value]) => (
								<div key={label}>
									<div className="mb-1 flex justify-between text-sm">
										<span className="capitalize">{label}</span>
										<span>{(value * 100).toFixed(2)}%</span>
									</div>
									<div className="h-2 overflow-hidden rounded-full bg-slate-700">
										<div
										className="h-full rounded-full bg-cyan-400"
										style={{
											width: `${Math.max(0, Math.min(100, value * 100))}%`,
										}}
										/>
									</div>
								</div>
							))}
							<p className="pt-2 text-xs text-slate-500">
								Probabilities are model estimates, not certainty that traffic is
								malicious or benign.
							</p>
						</div>
					)}
				</section>
			)}
		</div>
	);
}
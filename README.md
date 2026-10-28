# 🛡️ Sentinel — Botnet Traffic Detection

**An ML-powered network security application for detecting botnet traffic using Random Forest classification.**

🌐 **Live Demo:** [Try Sentinel](https://sentinel-botnet-detection.vercel.app/)

## 📌 About the Project

Sentinel is a machine-learning-based network security application that analyzes network-flow data and classifies traffic as **Normal** or **Botnet**.

The project combines a trained Random Forest model, a FastAPI backend, and a React-based dashboard to make traffic classification, suspicious-flow investigation, and model evaluation easier through a web interface.

It is designed primarily for **offline network traffic analysis** using uploaded CSV files and individual network-flow records.

## 🎯 Problem Statement

Identifying botnet traffic within large volumes of network activity can be challenging and time-consuming. Manual inspection makes it difficult to examine every flow and consistently identify suspicious patterns.

Sentinel addresses this problem by using machine learning to classify network flows and presenting the results in an interactive dashboard, helping users review potentially malicious traffic more efficiently.

## ✨ Key Features

- **Security Dashboard** — View traffic analysis summaries and detection statistics.
- **Single-Flow Prediction** — Classify an individual network-flow record.
- **Batch CSV Analysis** — Analyze multiple network flows from a CSV file.
- **Traffic Analysis** — Review classification results and probabilities.
- **Detection Alerts** — Filter and examine flows predicted as botnet.
- **Flow Investigation** — Search and inspect individual flows and their original features.
- **Model Evaluation** — Review accuracy, precision, recall, F1-score, and the confusion matrix.

## 🧰 Tech Stack

| Technology | Purpose |
|---|---|
| React, JavaScript, Vite | Frontend and user interface |
| CSS | Interface styling |
| Python | Backend and machine learning |
| FastAPI, Uvicorn | REST API |
| scikit-learn | Random Forest model and evaluation |
| pandas, NumPy | Data preprocessing and manipulation |
| Joblib | Saving and loading the trained model |
| PostgreSQL | Database integration in the applicable backend version |
| CTU-13 | Network-flow dataset for model development |

## 🤖 Machine Learning

Sentinel uses a **Random Forest classifier** trained on labeled network-flow data from the CTU-13 dataset.

The preprocessing pipeline handles numerical and categorical features, including flow duration, ports, packet counts, byte counts, protocol, direction, and connection state.

The model predicts one of two classes:

- `Normal (0)`
- `Botnet (1)`

### Reported Model Performance

The supplied expanded-model evaluation results report:

| Metric | Score |
|---|---:|
| Accuracy | 98.45% |
| Botnet Precision | 99.21% |
| Botnet Recall | 98.82% |
| Botnet F1-Score | 99.01% |

These results are from the project's held-out CTU-13 capture evaluation. Performance may differ on other datasets and real-world networks.

## 🚀 Deployment

- **Frontend:** [sentinel-botnet-detection.vercel.app](https://sentinel-botnet-detection.vercel.app/)
- **Source Code:** [View the GitHub Repository](https://github.com/Sanka-Vamsi-Akshay/sentinel-botnet-detection)

## 🔮 Future Improvements

- Live network-flow monitoring.
- Real-time detection and alerting.
- Improved model explainability.
- Evaluation on additional network datasets.
- Enhanced investigation and reporting tools.

## ⚠️ Disclaimer

Sentinel is an educational and research-oriented project intended to support network traffic analysis. Its predictions are not definitive proof of malicious activity, and the current application is not a replacement for a complete live-network intrusion detection system.

---

**Built to make network-flow analysis and botnet detection more accessible.**

"""Campus ML baseline. Put train.csv and test.csv next to this file.
Install: python -m pip install pandas scikit-learn
Run: python starter.py
"""

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

train = pd.read_csv("train.csv")
test = pd.read_csv("test.csv")
features = train.drop(columns=["id", "busy"])
target = train["busy"]
x_train, x_valid, y_train, y_valid = train_test_split(
    features, target, test_size=0.25, stratify=target, random_state=42
)

dummy = DummyClassifier(strategy="most_frequent")
dummy.fit(x_train, y_train)
print("Dummy F1:", f1_score(y_valid, dummy.predict(x_valid), zero_division=0))

numeric = features.select_dtypes(include="number").columns.tolist()
preprocessing = ColumnTransformer([
    ("numeric", StandardScaler(), numeric),
    ("category", OneHotEncoder(handle_unknown="ignore"), ["menu_type"]),
])
model = make_pipeline(preprocessing, LogisticRegression(max_iter=1000, random_state=42))
model.fit(x_train, y_train)
print("Logistic regression F1:", f1_score(y_valid, model.predict(x_valid), zero_division=0))

# Improve and compare models locally before using your daily submission attempts.
model.fit(features, target)
predictions = model.predict(test.drop(columns=["id"]))
pd.DataFrame({"id": test["id"], "busy": predictions}).to_csv("submission.csv", index=False)
print("Saved submission.csv. Add your analysis, experiments and conclusions in a notebook.")

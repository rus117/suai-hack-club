"""SUAI Hack Club: Titanic baseline.
Download train.csv and test.csv from the club's challenge page (not Kaggle).
Install: python -m pip install pandas scikit-learn
Run: python starter.py
"""
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

train = pd.read_csv("train.csv")
test = pd.read_csv("test.csv")
numeric = ["pclass", "age", "sibsp", "parch", "fare"]
categorical = ["sex", "embarked"]
features = numeric + categorical
X, y = train[features], train["survived"]
x_train, x_valid, y_train, y_valid = train_test_split(X, y, test_size=0.25, stratify=y, random_state=42)
dummy = DummyClassifier(strategy="most_frequent")
dummy.fit(x_train, y_train)
print("Dummy F1:", f1_score(y_valid, dummy.predict(x_valid), zero_division=0))
preprocessing = ColumnTransformer([
    ("numeric", make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), numeric),
    ("category", make_pipeline(SimpleImputer(strategy="most_frequent"), OneHotEncoder(handle_unknown="ignore")), categorical),
])
model = make_pipeline(preprocessing, LogisticRegression(max_iter=1000, random_state=42))
model.fit(x_train, y_train)
print("Logistic regression F1:", f1_score(y_valid, model.predict(x_valid), zero_division=0))
# Add your EDA, experiments and error analysis. Choose models on local validation.
model.fit(X, y)
submission = pd.DataFrame({"id": test["id"], "survived": model.predict(test[features]).astype(int)})
assert len(submission) == 300 and submission["id"].is_unique
submission.to_csv("submission.csv", index=False)
print("Saved submission.csv. Submit it with a link to your notebook and conclusions.")

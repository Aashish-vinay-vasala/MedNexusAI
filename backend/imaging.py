import io
from pathlib import Path

import numpy as np
import pydicom
import SimpleITK as sitk
import torch
import torch.nn.functional as F
from monai.networks.nets import DenseNet
from pydicom.data import get_testdata_file

MODEL_PATH = Path(__file__).parent / "models" / "mednist_classifier.pt"
MEDNIST_CLASSES = ["AbdomenCT", "BreastMRI", "CXR", "ChestCT", "Hand", "HeadCT"]

SAMPLES = [
    {"id": "ct_small", "label": "CT (sample)", "modality": "CT", "filename": "CT_small.dcm"},
    {"id": "mr_small", "label": "MRI (sample)", "modality": "MR", "filename": "MR_small.dcm"},
    {"id": "us_small", "label": "Ultrasound (sample)", "modality": "US", "filename": "examples_rgb_color.dcm"},
]


def build_classifier() -> DenseNet:
    return DenseNet(
        spatial_dims=2, in_channels=1, out_channels=len(MEDNIST_CLASSES),
        init_features=8, growth_rate=8, block_config=(2, 2),
    )


_model: DenseNet | None = None


def _get_model() -> DenseNet:
    global _model
    if _model is None:
        model = build_classifier()
        state = torch.load(MODEL_PATH, map_location="cpu")
        model.load_state_dict(state)
        model.eval()
        _model = model
    return _model


def list_samples() -> list[dict]:
    return [{"id": s["id"], "label": s["label"], "modality": s["modality"]} for s in SAMPLES]


def load_sample(sample_id: str) -> pydicom.Dataset:
    sample = next((s for s in SAMPLES if s["id"] == sample_id), None)
    if sample is None:
        raise ValueError(f"Unknown sample_id: {sample_id}")
    return pydicom.dcmread(get_testdata_file(sample["filename"]))


def load_uploaded(data: bytes) -> pydicom.Dataset:
    return pydicom.dcmread(io.BytesIO(data))


def _extract_metadata(ds: pydicom.Dataset) -> dict:
    def g(tag):
        val = getattr(ds, tag, None)
        return str(val) if val is not None else None

    pixel_spacing = getattr(ds, "PixelSpacing", None)
    return {
        "modality": g("Modality"),
        "rows": int(ds.Rows) if hasattr(ds, "Rows") else None,
        "columns": int(ds.Columns) if hasattr(ds, "Columns") else None,
        "pixel_spacing": [float(x) for x in pixel_spacing] if pixel_spacing else None,
        "body_part_examined": g("BodyPartExamined"),
        "study_date": g("StudyDate"),
        "bits_allocated": int(ds.BitsAllocated) if hasattr(ds, "BitsAllocated") else None,
    }


def _to_grayscale(pixel_array: np.ndarray) -> np.ndarray:
    if pixel_array.ndim == 3:
        return pixel_array.mean(axis=-1)
    return pixel_array


def _pixel_stats(gray: np.ndarray) -> dict:
    image = sitk.GetImageFromArray(gray.astype(np.float32))
    sobel = sitk.SobelEdgeDetection(image)
    sobel_arr = sitk.GetArrayFromImage(sobel)
    return {
        "mean_intensity": round(float(np.mean(gray)), 2),
        "std_intensity": round(float(np.std(gray)), 2),
        "contrast_metric": round(float(np.mean(sobel_arr)), 2),
    }


def _classify(gray: np.ndarray) -> dict:
    model = _get_model()
    img = gray.astype(np.float32)
    img = (img - img.min()) / (img.max() - img.min() + 1e-8)
    tensor = torch.from_numpy(img).unsqueeze(0).unsqueeze(0)
    tensor = F.interpolate(tensor, size=(64, 64), mode="bilinear", align_corners=False)
    with torch.no_grad():
        probs = torch.softmax(model(tensor), dim=1)[0]
    idx = int(torch.argmax(probs).item())
    return {"label": MEDNIST_CLASSES[idx], "confidence": round(float(probs[idx].item()), 4)}


def analyze_dicom(ds: pydicom.Dataset) -> dict:
    gray = _to_grayscale(ds.pixel_array)
    return {
        "metadata": _extract_metadata(ds),
        "pixel_stats": _pixel_stats(gray),
        "classification": _classify(gray),
    }

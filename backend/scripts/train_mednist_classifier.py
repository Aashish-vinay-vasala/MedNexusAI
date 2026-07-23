"""
One-time training script for the MONAI MedNIST modality/anatomy classifier used by
backend/imaging.py. NOT part of the deployed app — run manually to (re)produce
backend/models/mednist_classifier.pt, then commit the checkpoint.

Downloads MONAI's MedNIST dataset (~60MB, cached under backend/.cache) and trains a
small MONAI DenseNet for a few epochs on CPU.
"""

import sys
from pathlib import Path

import torch
from monai.apps import MedNISTDataset
from monai.data import DataLoader
from monai.transforms import Compose, EnsureChannelFirstd, LoadImaged, ScaleIntensityd

sys.path.insert(0, str(Path(__file__).parent.parent))
from imaging import MEDNIST_CLASSES, MODEL_PATH, build_classifier  # noqa: E402

ROOT_DIR = Path(__file__).parent.parent / ".cache"
EPOCHS = 3
BATCH_SIZE = 64


def main():
    ROOT_DIR.mkdir(exist_ok=True)
    transform = Compose([LoadImaged(keys="image"), EnsureChannelFirstd(keys="image"), ScaleIntensityd(keys="image")])

    train_ds = MedNISTDataset(root_dir=str(ROOT_DIR), section="training", transform=transform, download=True)
    val_ds = MedNISTDataset(root_dir=str(ROOT_DIR), section="validation", transform=transform, download=False)
    assert train_ds.get_num_classes() == len(MEDNIST_CLASSES), "MedNIST class count mismatch with imaging.MEDNIST_CLASSES"

    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

    model = build_classifier()
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
    loss_fn = torch.nn.CrossEntropyLoss()

    for epoch in range(EPOCHS):
        model.train()
        total_loss = 0.0
        for batch in train_loader:
            images, labels = batch["image"], batch["label"]
            optimizer.zero_grad()
            output = model(images)
            loss = loss_fn(output, labels)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
        print(f"Epoch {epoch + 1}/{EPOCHS} — train loss: {total_loss / len(train_loader):.4f}")

        model.eval()
        correct, total = 0, 0
        with torch.no_grad():
            for batch in val_loader:
                images, labels = batch["image"], batch["label"]
                preds = model(images).argmax(dim=1)
                correct += (preds == labels).sum().item()
                total += labels.size(0)
        print(f"Epoch {epoch + 1}/{EPOCHS} — val accuracy: {correct / total:.4f}")

    MODEL_PATH.parent.mkdir(exist_ok=True)
    torch.save(model.state_dict(), MODEL_PATH)
    print(f"Saved checkpoint to {MODEL_PATH}")


if __name__ == "__main__":
    main()

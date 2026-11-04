"""Make the paper collar and nodata border transparent."""
import numpy as np
from scipy import ndimage


def collar_alpha(rgb, white=245, black=5):
    """Alpha band: 0 for near-white/near-black regions touching the image edge, 255 elsewhere.
    White areas inside the map (paper between contours) stay opaque because they don't touch the edge."""
    background = (rgb.min(-1) >= white) | (rgb.max(-1) <= black)
    labels, _ = ndimage.label(background)
    edge = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    edge = edge[edge > 0]
    return np.where(np.isin(labels, edge), 0, 255).astype(np.uint8)

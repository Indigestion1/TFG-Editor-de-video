import base64
import sys
import os
os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"
import cv2
import torch
from sam2.build_sam import build_sam2, build_sam2_video_predictor
from sam2.sam2_image_predictor import SAM2ImagePredictor
from PIL import Image
import numpy as np
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import io
import signal


app = Flask(__name__)
CORS(app)

# device = torch.device("cpu")
sam2_checkpoint = "./checkpoints/sam2.1_hiera_large.pt"
model_cfg = "configs/sam2.1/sam2.1_hiera_l.yaml"
sam2_model = []
predictor = []
colors = np.array([
    [30/255, 144/255, 255/255, 0.6],
    [144/255, 255/255, 30/255, 0.6],
    [255/255, 30/255, 144/255, 0.6],
    [255/255, 144/255, 30/255, 0.6],
    [144/255, 30/255, 255/255, 0.6],
    [30/255, 255/255, 144/255, 0.6],
    [255/255, 255/255, 30/255, 0.6],
    [30/255, 30/255, 255/255, 0.6],
    [255/255, 30/255, 30/255, 0.6],
    [30/255, 255/255, 30/255, 0.6],
    [30/255, 30/255, 144/255, 0.6],
    [144/255, 30/255, 30/255, 0.6],
    [144/255, 144/255, 30/255, 0.6],
    [30/255, 144/255, 30/255, 0.6],
    [144/255, 144/255, 144/255, 0.6],
    [30/255, 30/255, 30/255, 0.6]
])

configured_images = {}

def rgba_to_hex(rgba):
    return '#{:02x}{:02x}{:02x}{:02x}'.format(int(rgba[0] * 255), 
                                              int(rgba[1] * 255), 
                                              int(rgba[2] * 255), 
                                              int(rgba[3] * 255))

@app.route('/predictImage', methods=['POST'])
def predict():
    data = request.json
    image_path = data['image_path']
    positive_points = data.get('positive_points', [])
    negative_points = data.get('negative_points', [])
    
    if image_path not in configured_images:
        return jsonify({"error": "Image not loaded", "path": image_path}), 404
    
    try:
        image = configured_images[image_path]["image"]
        color_index = len(configured_images[image_path]['masks']) % len(colors)
        color = colors[color_index]
        
        input_points = np.array(positive_points + negative_points)
        input_labels = np.array([1] * len(positive_points) + [0] * len(negative_points))
        
        masks, _, _ = predictor.predict(point_coords=input_points, point_labels=input_labels, multimask_output=False)
        mask = masks[0]
        
        h, w = mask.shape[-2:]
        mask = mask.astype(np.uint8)
        mask_image = mask.reshape(h, w, 1) * color.reshape(1, 1, -1)
        configured_images[image_path]["masks"].append({'mask': mask_image, 'points': input_points, 'color': color_index})
        
        mask_image_pil = Image.fromarray((mask_image * 255).astype(np.uint8))
        combined_image = Image.alpha_composite(Image.fromarray(image).convert("RGBA"), mask_image_pil)
        
        img_io_original = io.BytesIO()
        combined_image.save(img_io_original, 'PNG')
        img_io_original.seek(0)

        return send_file(img_io_original, mimetype='image/png', download_name='combined_image.png')
    except Exception as e:
        return jsonify({"error": str(e)}), 500  

@app.route('/mask', methods=['GET'])
def get_masks():
    data = request.args
    image_path = data.get('image_path')
    if image_path not in configured_images:
        return jsonify({"error": "Image not loaded", "path": image_path}), 404
    masks = []
    for mask in configured_images[image_path]["masks"]:
        # Convertir el color de RGBA a hexadecimal
        color_rgba = colors[mask["color"]]
        color_hex = rgba_to_hex(color_rgba)
        masks.append([color_hex])
    return jsonify({"masks": masks})
@app.route('/mask', methods=['DELETE'])
def delete_masks():
    data= request.json
    image_path = data['image_path']
    mask_index = data['mask_index']
    if image_path not in configured_images:
        return jsonify({"error": "Image not loaded", "path": image_path}), 404
    if mask_index >= len(configured_images[image_path]["masks"]):
        return jsonify({"error": "Invalid mask index", "index": mask_index}), 400
    configured_images[image_path]["masks"].pop(mask_index)
    return jsonify({"message": "Mask deleted successfully", "index": mask_index})

@app.route('/applyMask', methods=['POST'])
def apply_mask():
    data = request.json
    image_path = data['image_path']
    mask = data['mask']

    if image_path not in configured_images:
        return jsonify({"error": "Image not loaded", "path": image_path}), 404
    
    try:
        image = configured_images[image_path]["image"]
       
        combined_image = Image.fromarray(image).convert("RGBA")
        for mask_index in mask:
            mask_image = configured_images[image_path]["masks"][mask_index]['mask']
            mask_image_pil = Image.fromarray((mask_image * 255).astype(np.uint8))
            if mask_image_pil.mode != 'RGBA':
                mask_image_pil = mask_image_pil.convert('RGBA')
            combined_image = Image.alpha_composite(combined_image, mask_image_pil)
        
        # Guarda la imagen combinada en un objeto BytesIO
        img_io = io.BytesIO()
        combined_image.save(img_io, 'PNG')
        img_io.seek(0)
        # Reordenar las máscaras según el orden proporcionado en 'mask'
        
        return send_file(img_io, mimetype='image/png')
    except Exception as e:
        return jsonify({"error": str(e)}), 500

#Mateix codi però per les màscares en un fons negre
@app.route('/applyMaskBlack', methods=['POST'])
def apply_mask_black():
    data = request.json
    image_path = data['image_path']
    mask = data['mask']

    if image_path not in configured_images:
        return jsonify({"error": "Image not loaded", "path": image_path}), 404

    try:
        image = configured_images[image_path]["image"]
       
        black_baground = Image.new("RGBA", Image.fromarray(image).size, (31, 31, 31, 255))
        combined_image_black = black_baground.copy()
        for mask_index in mask:
            mask_image = configured_images[image_path]["masks"][mask_index]['mask']
            mask_image_pil = Image.fromarray((mask_image * 255).astype(np.uint8))
            if mask_image_pil.mode != 'RGBA':
                mask_image_pil = mask_image_pil.convert('RGBA')
            combined_image_black = Image.alpha_composite(combined_image_black, mask_image_pil)
        # Guarda la imagen combinada en un objeto BytesIO
        img_io_black = io.BytesIO()
        combined_image_black.save(img_io_black, 'PNG')
        img_io_black.seek(0)

        return send_file(img_io_black, mimetype='image/png')
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/addFrame', methods=['POST'])
def add_Frame():
    data = request.json
    image_path = data['image_path']

    if not image_path:
        return jsonify({"error": "Invalid image path"}), 400
        
    if image_path in configured_images:
        return jsonify({"message": "Frame already added", "path": image_path}), 200
    
    try:
        # Load the new image
        image = np.array(Image.open(image_path).convert("RGB"))
        
        # Set the new image in the predictor
        predictor.set_image(image)
        
        # Add the new image to the configured images dictionary
        configured_images[image_path] = {"image": image, "masks": []}
        
        return jsonify({"message": "Frame added successfully", "path": image_path})
    except Exception as e:
        return jsonify({"error": str(e)}), 500   
 
@app.route('/killServer', methods=['POST'])
def kill_server():
    os.kill(os.getpid(), signal.SIGINT)
    

@app.route('/propagate_segmentation', methods=['POST'])
def propagate_segmentation():
    data = request.json
    video_path = data['video_path']
    image_path = data['image_path']
    
    if image_path not in configured_images:
        return jsonify({"error": "Image not loaded", "path": image_path}), 404
    mask_points = []
    colors2 = []
    for mask in configured_images[image_path]["masks"]:
        points = mask['points']
        positive_points = [point for point, label in zip(points, mask['labels']) if label == 1]
        negative_points = [point for point, label in zip(points, mask['labels']) if label == 0]
        mask_points.append([np.array(positive_points, dtype=np.float32), np.array(negative_points, dtype=np.float32)])
        colors2.append(mask['color'])
    
    # Call the segmentation propagation function
    success = propagate_segmentation_in_video(video_path, mask_points, sam2_checkpoint, model_cfg, colors2)
    
    return jsonify({"success": success})

def propagate_segmentation_in_video(video_path: str, mask_points: list, checkpoint: str, config: str, colors2):
    # Initialize the video predictor
    predictor = build_sam2_video_predictor(config, checkpoint, device=torch.device('cpu'))
    inference_state = predictor.init_state(video_path)
    results_dir = '../TFG-Editor-de-video/data/results'
    images_dir = '../TFG-Editor-de-video/data/Videos\\'
    os.makedirs(results_dir, exist_ok=True)

    image_files = sorted([f for f in os.listdir(video_path) if os.path.isfile(os.path.join(video_path, f))])

    reference_shape = None
    for image_file in image_files:
        image_path = os.path.join(video_path, image_file)
        frame = np.array(Image.open(image_path).convert("RGB"))
        if frame is None:
            print("No se puede leer la imagen")
            raise ValueError(f"No se puede leer la imagen {image_path}")
        if reference_shape is None:
            reference_shape = frame.shape
        elif frame.shape != reference_shape:
            raise ValueError(f"La imagen {image_path} tiene una forma diferente a la de referencia {reference_shape}")
    frame_idx = 0
    
    with torch.inference_mode():
        obj_id = 1

        # Add the segmentation of the first frame to the inference state using points
        for positive_points, negative_points in mask_points:
            if frame_idx >= len(inference_state["images"]):
                break
            points = np.concatenate((positive_points, negative_points), axis=0)
            labels = np.array([1] * len(positive_points) + [0] * len(negative_points))
            frame_idx, object_ids, masks = predictor.add_new_points_or_box(inference_state, points=points.tolist(), labels=labels.tolist(), obj_id=obj_id, frame_idx=frame_idx)
            obj_id += 1

        # Propagate the segmentation through the frames
        for response in predictor.propagate_in_video(inference_state):
            frame_idx, object_ids, masks = response  # Unpack the tuple
            masks = [mask.cpu().numpy() for mask in masks]  # Convert tensors to numpy arrays
            if frame_idx >= len(image_files):
                break
            image_path = os.path.join(video_path, image_files[frame_idx])
            frame = np.array(Image.open(image_path).convert("RGB"))

            if frame is None:
                print(f"Error: No se puede leer la imagen {image_path}")
                continue
            if frame.shape is None or len(frame.shape) < 2:
                print(f"Error: La imagen {image_path} tiene una forma inválida")
                raise ValueError(f"El frame {image_path} tiene una forma inválida: {frame.shape}")
                continue
            background = np.zeros((frame.shape[0], frame.shape[1], 4), dtype=np.uint8)
            i = 0
            processed_masks = []
            for mask in masks:
                if mask.shape[0] == 1:
                    mask = np.squeeze(mask, axis=0)
                mask = (mask > 0.0).astype(np.uint8)
                if mask.shape[:2] != background.shape[:2]:
                    mask = cv2.resize(mask, (background.shape[1], background.shape[0]), interpolation=cv2.INTER_NEAREST)
                color1 = colors[colors2[i]].copy()
                color2 = colors[colors2[i]]
                color1[:3] = (color1[:3] * 255).astype(np.uint8)
                color = color1[[2, 1, 0, 3]]  # RGBA --> BGRA
                mask_image = mask.reshape(mask.shape[0], mask.shape[1], 1) * color2.reshape(1, 1, -1)
                background[mask > 0] = color
                processed_masks.append({'mask': mask_image, 'color': colors2[i]})
                i += 1
            image_path2 = images_dir + f'{frame_idx}.jpeg'
            if image_path2 not in configured_images:
                configured_images[image_path2] = {"image": frame, "masks": []}
                configured_images[image_path2]["masks"] = processed_masks

            for mask_info in configured_images[image_path2]["masks"]:
                mask = mask_info['mask']
                if mask.shape[:2] != frame.shape[:2]:
                    mask = cv2.resize(mask, (frame.shape[1], frame.shape[0]), interpolation=cv2.INTER_NEAREST)
                    mask_info['mask'] = mask

            # Save the segmented frame
            cv2.imwrite(os.path.join(results_dir, f'frame_{frame_idx:04d}.png'), background)
            print(f'Frame {frame_idx} segmented')
    
    return True

def signal_handler(sig, frame):
    print('Exiting...')
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)

@app.route('/color' , methods=['POST'])
def change_color():
    global colors
    data = request.json
    image_path = data['image_path']
    mask_index = data['mask_index']
    color_Rgba = data['color']

    if image_path not in configured_images:
        return jsonify({"error": "Image not loaded", "path": image_path}), 404
    if mask_index >= len(configured_images[image_path]["masks"]):
        return jsonify({"error": "Invalid mask index", "index": mask_index}), 400

    #print(color_Rgba)
    color_Rgba = np.array(color_Rgba, dtype=float).reshape(1, 4)
    colors = np.vstack([colors, color_Rgba])
    configured_images[image_path]["masks"][mask_index]['color'] = len(colors) - 1
    # Actualiza el color en la máscara
    mask_image = configured_images[image_path]["masks"][mask_index]['mask']
    mask = (mask_image[:, :, 3] > 0).astype(np.uint8)  # Obtén la máscara binaria
    new_color = colors[-1]
    new_mask_image = mask.reshape(mask.shape[0], mask.shape[1], 1) * new_color.reshape(1, 1, -1)
    configured_images[image_path]["masks"][mask_index]['mask'] = new_mask_image
    return jsonify({"message": "Color changed successfully", "index": mask_index})

@app.route('/download_video', methods=['POST'])
def download_video():

    input_folder = '../TFG-Editor-de-video/data/results'
    output_folder = '../TFG-Editor-de-video/data/video_results'
    output_filename = 'output_video.avi'
    fps = 24

    # Crear la carpeta de salida si no existe
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)

    # Obtener la lista de archivos de la carpeta de entrada
    frame_files = [f for f in os.listdir(input_folder) if os.path.isfile(os.path.join(input_folder, f))]
    frame_files.sort()  # Ordenar los archivos por nombre

    # Leer el primer fotograma para obtener las dimensiones del vídeo
    first_frame_path = os.path.join(input_folder, frame_files[0])
    first_frame = cv2.imread(first_frame_path)
    height, width, layers = first_frame.shape

    # Crear el objeto VideoWriter
    output_path = os.path.join(output_folder, output_filename)
    fourcc = cv2.VideoWriter_fourcc(*'XVID')
    video_writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    # Iterar sobre los archivos de la carpeta de entrada y escribirlos en el vídeo
    for frame_file in frame_files:
        frame_path = os.path.join(input_folder, frame_file)
        frame = cv2.imread(frame_path)
        video_writer.write(frame)

    # Liberar el objeto VideoWriter y cerrar todas las ventanas de OpenCV
    video_writer.release()
    cv2.destroyAllWindows()

    # Enviar el archivo de vídeo resultante como respuesta a la solicitud POST
    return jsonify({"message": "Video created successfully", "output_path": output_path})
    #return send_file(output_path, as_attachment=True) Es possible enviar el video si creiem que és important


@app.route('/change_order', methods=['POST'])
def change_order():
    data = request.json
    image_path = data['image_path']
    mask_indices = data['masks']

    if image_path not in configured_images:
        return jsonify({"error": "Image path not found"}), 404

    masks = configured_images[image_path]["masks"]
    new_masks = masks.copy()

    positions_to_place = sorted(mask_indices)
    masks_to_rearrange = [masks[i] for i in mask_indices]

    for pos, mask in zip(positions_to_place, masks_to_rearrange):
        new_masks[pos] = mask

    configured_images[image_path]["masks"] = new_masks

    return jsonify({"message": "Order changed successfully", "path": image_path})

if __name__ == '__main__':
    if torch.cuda.is_available():
        device = torch.device("cuda")
    elif torch.backends.mps.is_available():
        device = torch.device("mps")
    else:
        device = torch.device("cpu")
    print(f"using device: {device}")
    
    sam2_model = build_sam2(model_cfg, sam2_checkpoint, device=device)
    predictor = SAM2ImagePredictor(sam2_model)
    app.run(host='0.0.0.0', port=5000)
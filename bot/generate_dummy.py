import os
dummy_file_path = os.path.join(os.getcwd(), "dummy_evidence.png")
if not os.path.exists(dummy_file_path):
    with open(dummy_file_path, 'wb') as f:
        # Create a tiny 1x1 png
        f.write(b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82')
print("Dummy evidence generated!")

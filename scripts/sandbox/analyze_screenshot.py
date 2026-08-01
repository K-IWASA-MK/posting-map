from PIL import Image

def analyze():
    try:
        img = Image.open('/Users/katsujiiwasa/.gemini/antigravity-ide/brain/0011dc8c-0d04-4974-b697-be1efc50f396/screenshot_final.png')
        img = img.convert('RGB')
        width, height = img.size
        
        red_pixels = 0
        white_pixels = 0
        black_pixels = 0
        other_pixels = 0
        
        for y in range(height):
            for x in range(width):
                r, g, b = img.getpixel((x, y))
                if r > 200 and g < 50 and b < 50:
                    red_pixels += 1
                elif r > 240 and g > 240 and b > 240:
                    white_pixels += 1
                elif r < 20 and g < 20 and b < 20:
                    black_pixels += 1
                else:
                    other_pixels += 1
                    
        total = width * height
        print(f"Total: {total}")
        print(f"Red: {red_pixels} ({red_pixels/total*100:.2f}%)")
        print(f"White: {white_pixels} ({white_pixels/total*100:.2f}%)")
        print(f"Black: {black_pixels} ({black_pixels/total*100:.2f}%)")
        print(f"Other: {other_pixels} ({other_pixels/total*100:.2f}%)")
        
        if red_pixels == 0 and white_pixels > total * 0.9:
            print("RESULT: A (All white, no red outlines)")
        elif red_pixels > 0 and white_pixels > total * 0.5 and other_pixels < total * 0.05:
            print("RESULT: B (Red outlines and white background, but no content)")
        elif red_pixels > 0 and black_pixels > total * 0.5:
            print("RESULT: C (Red outlines but mostly black background/overlay)")
        elif red_pixels > 0 and other_pixels > total * 0.05:
            print("RESULT: D (Red outlines and varied content visible)")
        else:
            print("RESULT: Unknown state")
            
    except Exception as e:
        print("Error:", e)

analyze()

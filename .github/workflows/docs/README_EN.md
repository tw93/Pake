# GitHub Actions compilation and configuration tutorial

## 1. Fork this project

[Fork this project](https://github.com/tw93/Pake/fork)

## 2. Go to the actions page to enable GitHub actions

![image-20221205230324046](assets/image-20221205230324046.png)

## 3. Modify the app.csv file

![image-20221205230432205](assets/image-20221205230432205.png)

Modify the app.csv file and replace the content after the second line with custom content

![image-20221205230553980](assets/image-20221205230553980.png)

The format is: `Linux application name, Mac and Windows application name, Chinese character name, URL`, pay attention to use English commas to separate

## 4. Upload icon

- Upload the .icns file to the `/src-tauri/icons` directory (required)
- Upload the .ico and .png files to the `/src-tauri/png` directory (you can skip this step if you use the script to convert automatically)

**Note: Two .ico files and one .png file are required, refer to the table below**

| File Name   | Description                        |
| ----------- | ---------------------------------- |
| app_32.ico  | A ico file with a size of 32\*32   |
| app_256.ico | A ico file with a size of 256\*256 |
| app_512.png | A png file with a size of 512\*512 |

> You can also directly git the entire project to the local, and use the icns2png.py file in the project root directory to batch convert .icns files into .ico and .png files (.icns files are required)
>
> Don't forget to upload the corresponding file after the conversion is complete

## 5. Change the configuration file (optional, used to further customize the compiled program)

Go to the `/src-tauri/` directory and modify the **tauri.conf.json** file

Refer to the picture below to customize the configuration. **It is recommended to modify the content with an asterisk**. Others can use the default

![image-20221206113351850](assets/image-20221206113351850.png)

## 6. Publish to start running automatic compilation

- Click to go to the Releases page

![image-20221205233624044](assets/image-20221205233624044.png)

![image-20221205233722029](assets/image-20221205233722029.png)

- Click **Create a new release**

![image-20221205233806355](assets/image-20221205233806355.png)

- Click **Choose a tag** and enter `V0.1.0` (the version number can be customized, but **must start with a capital V**)

![image-20221205233956978](assets/image-20221205233956978.png)

- Click the **Create new tag** button below

![image-20221205234436283](assets/image-20221205234436283.png)

- Fill in title and content (optional)
- If you are not modifying in the `master` branch, you need to select the corresponding branch in the target drop-down bar
- Click **Publish release**
- At this point, go to the actions page and make sure the new workflows appear

![image-20221205234306770](assets/image-20221205234306770.png)

After the compilation is completed, you can see the files generated after the compilation is completed on the release page (compilation takes about 10-30 minutes)

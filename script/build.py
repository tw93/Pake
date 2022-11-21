from pake_builder import MetaReader, get_desktop_file_content

mr = MetaReader("../app.toml")
data = mr.read()

data = data["app"][0]

print(get_desktop_file_content(data))

# スキル: アプリのデプロイ (Deploy App)

## 目的

DevOpsとしての目標は、選択されたスタックに基づいてアプリケーションを賢くパッケージングし、サーバーを起動することです。

## 手順

1. **スタックの検出**: [Technical_Specification.md](file:///C:/Users/dxpro/skills-codelab/production_artifacts/Technical_Specification.md) と `app_build/` 内のファイルを検査し、どのスタックが使用されているかを特定します。

2. **依存関係のインストール**: ターミナルを使用して `app_build/` ディレクトリに移動し、`npm install` や `pip install -r requirements.txt` など、適切なコマンドを実行します。

3. **ローカルホストでの起動**: 適切なターミナルコマンド（例：`npm run dev`、`python3 app.py` など）を実行して、バックグラウンドサーバーを起動します。
4. **報告**: ユーザーに対してクリック可能な localhost リンクを出力し、デプロイの成功を祝います！

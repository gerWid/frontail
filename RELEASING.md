# Releasing Frontail

After all [pull requests](https://github.com/gerwid/frontail/pulls) for a release have been merged and CI is green on the default branch, you may create a release as follows:

1. If you haven't already, switch to the default branch, ensure that you have no changes, and pull from origin.

    ```sh
    $ git checkout main
    $ git status
    $ git pull origin main --rebase
    ```

1. Edit the `package.json` file changing the `version` field to your new release version and run `npm i`.

1. Commit your changes.

    ```sh
    $ git commit -am "Release <version>"
    ```

1. Tag and push the commit.

    ```sh
    $ git tag v<version>
    $ git push origin head --tags
    ```

1. Publish a new release on GitHub for the tag.

1. Build and upload binaries.

    ```sh
    $ npm run pkg
    ```
